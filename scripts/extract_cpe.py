"""
Extrai todos os registos CPE do SOAP endpoint da Nabalia Energia para CSV.

Uso:
    python extract_cpe.py <bearer_token> [ficheiro_saida.csv]

O token Bearer obtém-se nas DevTools do browser (Network > Headers > Authorization).
Validade tipicamente 1h — se expirar, faz novo login e copia o token novo.
"""

import requests
import xml.etree.ElementTree as ET
import csv
import time
import sys

ENDPOINT = (
    "https://nabalia-proxy-c0fngke2c5fvh5hg.westeurope-01.azurewebsites.net"
    "/api/soap/Page/WSCpe_Ponto_Entrega"
)
SOAP_ACTION = '"urn:microsoft-dynamics-schemas/page/wscpe_ponto_entrega:ReadMultiple"'
XMLNS = "urn:microsoft-dynamics-schemas/page/wscpe_ponto_entrega"
PAGE_SIZE = 100   # 100 registos/pedido — confortável dentro do limite de 120 req
SLEEP_SEC = 0.6   # ~100 req/min


def build_envelope(filters=None, bookmark_key=None):
    filters_xml = ""
    if filters:
        for field, criteria in filters.items():
            filters_xml += (
                f"\n      <filter>"
                f"\n        <Field>{field}</Field>"
                f"\n        <Criteria>{criteria}</Criteria>"
                f"\n      </filter>"
            )

    bookmark_xml = (
        f"\n      <bookmarkKey>{bookmark_key}</bookmarkKey>"
        if bookmark_key
        else ""
    )

    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
        "<soap:Body>"
        f'<ReadMultiple xmlns="{XMLNS}">'
        f"{filters_xml}"
        f"{bookmark_xml}"
        f"\n      <setSize>{PAGE_SIZE}</setSize>"
        "</ReadMultiple>"
        "</soap:Body>"
        "</soap:Envelope>"
    )


def parse_response(xml_text):
    """Devolve (lista_de_dicts, ultimo_bookmark_key)."""
    root = ET.fromstring(xml_text)
    tag_result = f"{{{XMLNS}}}ReadMultipleResult"
    tag_item = f"{{{XMLNS}}}WSCpe_Ponto_Entrega"

    result_node = root.find(f".//{tag_result}")
    if result_node is None:
        return [], None

    records = []
    for item in result_node.findall(tag_item):
        record = {
            child.tag.replace(f"{{{XMLNS}}}", ""): (child.text or "")
            for child in item
        }
        records.append(record)

    last_key = records[-1].get("Key") if records else None
    return records, last_key


def fetch_all(token, filters=None, output_file="cpe_export.csv"):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/xml;charset=utf-8",
        "SOAPAction": SOAP_ACTION,
        "Accept": "text/xml",
    }

    all_records = []
    bookmark_key = None
    page = 1

    while True:
        print(f"  Página {page}...", end=" ", flush=True)
        body = build_envelope(filters=filters, bookmark_key=bookmark_key)

        try:
            resp = requests.post(
                ENDPOINT,
                data=body.encode("utf-8"),
                headers=headers,
                timeout=30,
            )
        except requests.RequestException as e:
            print(f"\nErro de rede: {e}")
            break

        if resp.status_code == 401:
            print("\nToken expirado ou inválido. Obtém um novo token no browser.")
            break
        if resp.status_code != 200:
            print(f"\nErro HTTP {resp.status_code}:\n{resp.text[:400]}")
            break

        records, last_key = parse_response(resp.text)
        print(f"{len(records)} registos")

        if not records:
            break

        all_records.extend(records)

        if len(records) < PAGE_SIZE:
            break  # última página

        bookmark_key = last_key
        page += 1
        time.sleep(SLEEP_SEC)

    print(f"\nTotal extraído: {len(all_records)} registos")

    if not all_records:
        print("Nenhum registo para exportar.")
        return []

    with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=all_records[0].keys())
        writer.writeheader()
        writer.writerows(all_records)

    print(f"Ficheiro CSV: {output_file}")
    return all_records


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    token = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "cpe_export.csv"

    # Para filtrar por distrito, CAE, etc., passa um dict:
    #   filters={"Voltage_Code": "MT", "Postal_Cod": "*1000*"}
    # Para exportar TUDO, deixa filters=None
    fetch_all(token, filters=None, output_file=out)
