"""
Ferramenta interativa para pesquisa de CPEs na Nabalia Energia.

Uso:
    python nabalia_cpe.py

Na primeira execução pede agentId e password — ficam guardados em
.nabalia_creds.json (na mesma pasta). O token é renovado automaticamente
quando expira; o login só é chamado quando necessário (rate limit: 10/período).
"""

import requests
import xml.etree.ElementTree as ET
import csv
import json
import os
import sys
import time
import base64
import getpass
from datetime import datetime

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
BASE = "https://nabalia-proxy-c0fngke2c5fvh5hg.westeurope-01.azurewebsites.net"
AUTH_URL   = f"{BASE}/api/auth/login"
SOAP_URL   = f"{BASE}/api/soap/Page/WSCpe_Ponto_Entrega"
SOAP_ACT   = '"urn:microsoft-dynamics-schemas/page/wscpe_ponto_entrega:ReadMultiple"'
XMLNS      = "urn:microsoft-dynamics-schemas/page/wscpe_ponto_entrega"

SCRIPT_DIR     = os.path.dirname(os.path.abspath(__file__))
CREDS_FILE     = os.path.join(SCRIPT_DIR, ".nabalia_creds.json")
TOKEN_FILE     = os.path.join(SCRIPT_DIR, ".nabalia_token.json")

PAGE_SIZE  = 100
SLEEP_SEC  = 0.7   # ~85 req/min, dentro do limite de 120


# ---------------------------------------------------------------------------
# Credenciais
# ---------------------------------------------------------------------------

def load_credentials():
    if os.path.exists(CREDS_FILE):
        with open(CREDS_FILE, encoding="utf-8") as f:
            return json.load(f)
    return None


def prompt_and_save_credentials():
    print("\n-- Credenciais Nabalia --")
    agent_id = input("agentId: ").strip()
    password = getpass.getpass("Password: ")
    creds = {"agentId": agent_id, "password": password}
    with open(CREDS_FILE, "w", encoding="utf-8") as f:
        json.dump(creds, f)
    print(f"Credenciais guardadas em {CREDS_FILE}\n")
    return creds


# ---------------------------------------------------------------------------
# Autenticação e token
# ---------------------------------------------------------------------------

def _jwt_expiry(token: str):
    """Devolve o timestamp de expiração do JWT, ou None se não conseguir ler."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (4 - len(payload) % 4)
        data = json.loads(base64.b64decode(payload))
        return data.get("exp")
    except Exception:
        return None


def _token_valid(token: str) -> bool:
    exp = _jwt_expiry(token)
    if exp is None:
        return False
    return exp - time.time() > 300   # margem de 5 minutos


def _load_cached_token():
    if not os.path.exists(TOKEN_FILE):
        return None
    with open(TOKEN_FILE, encoding="utf-8") as f:
        data = json.load(f)
    token = data.get("token")
    return token if token and _token_valid(token) else None


def _save_token(token: str):
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump({"token": token}, f)


def login(creds: dict) -> str:
    print("A autenticar...", end=" ", flush=True)
    resp = requests.post(
        AUTH_URL,
        json={"agentId": creds["agentId"], "password": creds["password"]},
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Login falhou ({resp.status_code}): {resp.text[:200]}")

    data = resp.json()
    # O token pode estar em vários campos consoante a API
    token = (
        data.get("token")
        or data.get("accessToken")
        or data.get("access_token")
        or data.get("jwt")
    )
    if not token:
        # Tenta a primeira string longa que encontrar
        for v in data.values():
            if isinstance(v, str) and len(v) > 100:
                token = v
                break
    if not token:
        raise RuntimeError(f"Não encontrei token na resposta: {data}")

    _save_token(token)
    print("OK")
    return token


def get_token(creds: dict) -> str:
    cached = _load_cached_token()
    if cached:
        return cached
    return login(creds)


# ---------------------------------------------------------------------------
# Pesquisa SOAP
# ---------------------------------------------------------------------------

def _build_envelope(filters: dict, bookmark_key=None) -> bytes:
    filters_xml = "".join(
        f"<filter><Field>{k}</Field><Criteria>{v}</Criteria></filter>"
        for k, v in filters.items()
        if v
    )
    bookmark_xml = f"<bookmarkKey>{bookmark_key}</bookmarkKey>" if bookmark_key else ""
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
        "<soap:Body>"
        f'<ReadMultiple xmlns="{XMLNS}">'
        f"{filters_xml}"
        f"{bookmark_xml}"
        f"<setSize>{PAGE_SIZE}</setSize>"
        "</ReadMultiple>"
        "</soap:Body>"
        "</soap:Envelope>"
    )
    return xml.encode("utf-8")


def _parse_records(xml_text: str):
    root = ET.fromstring(xml_text)
    result = root.find(f".//{{{XMLNS}}}ReadMultipleResult")
    if result is None:
        return [], None
    items = result.findall(f"{{{XMLNS}}}WSCpe_Ponto_Entrega")
    records = [
        {child.tag.replace(f"{{{XMLNS}}}", ""): (child.text or "") for child in item}
        for item in items
    ]
    last_key = records[-1].get("Key") if records else None
    return records, last_key


def search_cpe(token: str, postal_cod: str, voltage_code: str) -> list:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/xml;charset=utf-8",
        "SOAPAction": SOAP_ACT,
        "Accept": "text/xml",
    }
    filters = {}
    if postal_cod:
        filters["Postal_Cod"] = f"*{postal_cod}*"
    if voltage_code:
        filters["Voltage_Code"] = voltage_code

    all_records = []
    bookmark_key = None
    page = 1

    while True:
        print(f"  Pág. {page}...", end=" ", flush=True)
        resp = requests.post(
            SOAP_URL,
            data=_build_envelope(filters, bookmark_key),
            headers=headers,
            timeout=30,
        )
        if resp.status_code == 401:
            raise RuntimeError("Token expirado durante a pesquisa.")
        if resp.status_code != 200:
            raise RuntimeError(f"Erro {resp.status_code}: {resp.text[:300]}")

        records, last_key = _parse_records(resp.text)
        print(f"{len(records)} registos")
        all_records.extend(records)

        if len(records) < PAGE_SIZE:
            break
        bookmark_key = last_key
        page += 1
        time.sleep(SLEEP_SEC)

    return all_records


# ---------------------------------------------------------------------------
# Apresentação
# ---------------------------------------------------------------------------

COLS = [
    ("CPE",             "No",            30),
    ("Nome",            "Name",          35),
    ("NIPC",            "VAT_No",        12),
    ("Cód. Postal",     "Postal_Cod",    12),
    ("Localidade",      "City",          15),
    ("Nível Tensão",    "Voltage_Code",   8),
    ("CAE",             "CAE_Code",       6),
    ("Tipo Período",    "Tariff_Code",   10),
    ("Início Contrato", "Starting_Date", 14),
    ("CMA",             "CMA",            8),
]


def display(records: list):
    if not records:
        print("  (sem resultados)")
        return
    header = "  ".join(label.ljust(w) for label, _, w in COLS)
    sep    = "  ".join("-" * w for _, _, w in COLS)
    print(f"\n{header}")
    print(sep)
    for r in records:
        row = "  ".join(r.get(field, "")[:w].ljust(w) for _, field, w in COLS)
        print(row)
    print(f"\n{len(records)} registo(s)\n")


def save_csv(records: list, path: str):
    if not records:
        return
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    print(f"Guardado em {path}")


# ---------------------------------------------------------------------------
# Loop interativo
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  Nabalia CPE — Pesquisa interativa")
    print("=" * 60)

    creds = load_credentials()
    if not creds:
        creds = prompt_and_save_credentials()

    try:
        token = get_token(creds)
    except RuntimeError as e:
        print(f"\nErro de autenticação: {e}")
        print("Verifica as credenciais e tenta de novo.")
        if os.path.exists(CREDS_FILE):
            os.remove(CREDS_FILE)
        sys.exit(1)

    print("\nComandos: 'sair' para terminar | Enter em branco = sem filtro\n")

    while True:
        print("-" * 60)
        postal  = input("Código postal (ex: 1000, 4400, 2750): ").strip()
        voltage = input("Tipo contrato [MT / BTE / Enter=todos]: ").strip().upper()

        if postal.lower() == "sair" or voltage.lower() == "sair":
            break
        if voltage not in ("MT", "BTE", ""):
            print("Tipo inválido. Usa MT, BTE ou Enter para todos.")
            continue

        print()
        try:
            # Renova token se necessário
            token = get_token(creds)
            records = search_cpe(token, postal, voltage)
        except RuntimeError as e:
            print(f"Erro: {e}")
            # Força novo login na próxima tentativa
            if os.path.exists(TOKEN_FILE):
                os.remove(TOKEN_FILE)
            continue

        display(records)

        if records:
            guardar = input("Guardar CSV? (s/n): ").strip().lower()
            if guardar == "s":
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                tag = f"{postal or 'todos'}_{voltage or 'todos'}"
                path = os.path.join(SCRIPT_DIR, f"cpe_{tag}_{stamp}.csv")
                save_csv(records, path)

        print()

    print("Até logo.")


if __name__ == "__main__":
    main()
