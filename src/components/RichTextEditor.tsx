"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";

const CORES = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#d97706"];

async function uploadImageFile(file: File): Promise<string> {
  const res = await fetch(`/api/email/upload?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    body: file,
  });
  if (!res.ok) throw new Error("Falha no upload da imagem");
  const { url } = await res.json();
  return url as string;
}

export default function RichTextEditor({ value, onChange, placeholder }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Image.configure({ inline: false }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] px-3 py-2 focus:outline-none",
      },
      handlePaste(view, event) {
        const file = Array.from(event.clipboardData?.items ?? [])
          .find((item) => item.type.startsWith("image/"))
          ?.getAsFile();
        if (!file) return false;

        event.preventDefault();
        setUploading(true);
        uploadImageFile(file)
          .then((url) => {
            const node = view.state.schema.nodes.image.create({ src: url });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
          })
          .catch(() => alert("Não foi possível enviar a imagem colada."))
          .finally(() => setUploading(false));
        return true;
      },
      handleDrop(view, event) {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;

        event.preventDefault();
        setUploading(true);
        uploadImageFile(file)
          .then((url) => {
            const node = view.state.schema.nodes.image.create({ src: url });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
          })
          .catch(() => alert("Não foi possível enviar a imagem."))
          .finally(() => setUploading(false));
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && document.activeElement?.closest(".tiptap") === null) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;

    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      alert("Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 text-xs rounded border ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 border-b border-gray-200 px-2 py-1.5">
        <button type="button" className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}><b>N</b></button>
        <button type="button" className={btn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" className={btn(editor.isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}><u>S</u></button>
        <button type="button" className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>Lista</button>

        <span className="w-px h-5 bg-gray-300 mx-1" />

        {CORES.map((cor) => (
          <button key={cor} type="button" title={cor}
            className="w-5 h-5 rounded-full border border-gray-300"
            style={{ backgroundColor: cor }}
            onClick={() => editor.chain().focus().setColor(cor).run()} />
        ))}
        <button type="button" className="text-xs text-gray-500 px-1.5 hover:underline"
          onClick={() => editor.chain().focus().unsetColor().run()}>Limpar cor</button>

        <span className="w-px h-5 bg-gray-300 mx-1" />

        <button type="button" className={btn(false)} disabled={uploading}
          onClick={() => fileInputRef.current?.click()}>
          {uploading ? "A enviar..." : "🖼 Imagem"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
      </div>

      <EditorContent editor={editor} placeholder={placeholder} />
      {uploading && (
        <p className="text-xs text-blue-600 px-3 pb-2">A enviar imagem...</p>
      )}
    </div>
  );
}
