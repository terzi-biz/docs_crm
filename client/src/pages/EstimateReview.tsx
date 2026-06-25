import { useRef, useState } from "react";
import { api } from "../api";

type Item = {
  position: number;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  sum: number;
  category?: string;
  confidence?: number;
  source_text?: string;
};

const ACCEPT = ".xlsx,.xls,.pdf,.docx,.doc";

export default function EstimateBlock({
  estimate,
  onSaved,
}: {
  estimate: any;
  onSaved: (e: any) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const updated = await api.uploadEstimate(estimate.objectId, file);
      onSaved(updated);
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!estimate.row) {
    return (
      <UploadZone
        dragOver={dragOver}
        setDragOver={setDragOver}
        uploading={uploading}
        uploadError={uploadError}
        fileInputRef={fileInputRef}
        onFile={handleFile}
        title="Завантажте кошторис від прораба"
        subtitle="Підтримуються формати XLSX, XLS, PDF, DOCX. Дані буде розпізнано автоматично."
      />
    );
  }

  if (estimate.row.status === "confirmed") {
    return (
      <div>
        <div className="bg-[#0b1830]/5 border border-[#0b1830]/10 rounded-lg p-4 mb-4 text-sm">
          <p className="font-medium text-[#0b1830]">Кошторис підтверджено</p>
          <p className="text-gray-600 mt-1">
            Разом: {Number(estimate.row.grand_total).toLocaleString("uk-UA")} грн
          </p>
        </div>
        <UploadZone
          dragOver={dragOver}
          setDragOver={setDragOver}
          uploading={uploading}
          uploadError={uploadError}
          fileInputRef={fileInputRef}
          onFile={handleFile}
          title="Завантажити новий файл"
          subtitle="Це створить нову версію кошторису, яку потрібно перевірити та підтвердити знову."
          compact
        />
      </div>
    );
  }

  return (
    <div>
      <EstimateEditor estimate={estimate.row} onSaved={onSaved} />
      <div className="mt-4">
        <UploadZone
          dragOver={dragOver}
          setDragOver={setDragOver}
          uploading={uploading}
          uploadError={uploadError}
          fileInputRef={fileInputRef}
          onFile={handleFile}
          title="Завантажити інший файл"
          subtitle="Якщо розпізнавання невдале — спробуйте завантажити інший файл кошторису."
          compact
        />
      </div>
    </div>
  );
}

function UploadZone({
  dragOver,
  setDragOver,
  uploading,
  uploadError,
  fileInputRef,
  onFile,
  title,
  subtitle,
  compact,
}: any) {
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={
          "border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors " +
          (compact ? "p-4" : "p-10") +
          " " +
          (dragOver
            ? "border-[#c9a44c] bg-[#c9a44c]/10"
            : "border-gray-300 hover:border-[#c9a44c] hover:bg-gray-50")
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        {!compact && (
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#0b1830] text-[#c9a44c] flex items-center justify-center text-2xl">
            ⭱
          </div>
        )}
        <p className="font-medium text-[#0b1830]">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        {uploading ? (
          <p className="text-sm text-[#c9a44c] mt-3 animate-pulse">
            Аналізуємо смету... ({"Витягуємо дані → Розпізнаємо → Перевіряємо суми"})
          </p>
        ) : (
          <button
            type="button"
            className="btn-gold px-4 py-2 rounded mt-3 text-sm font-medium"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Завантажити смету
          </button>
        )}
      </div>
      {uploadError && <p className="text-red-600 text-sm mt-2">{uploadError}</p>}
    </div>
  );
}

function EstimateEditor({ estimate, onSaved }: { estimate: any; onSaved: (e: any) => void }) {
  const [materials, setMaterials] = useState<Item[]>(JSON.parse(estimate.materials_json));
  const [works, setWorks] = useState<Item[]>(JSON.parse(estimate.works_json));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const warnings: string[] = JSON.parse(estimate.warnings_json || "[]");

  async function reanalyze() {
    setBusy(true);
    setError("");
    try {
      const updated = await api.reanalyzeEstimate(estimate.id);
      setMaterials(JSON.parse(updated.materials_json));
      setWorks(JSON.parse(updated.works_json));
      onSaved(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function updateItem(list: Item[], setList: (v: Item[]) => void, idx: number, field: keyof Item, value: string) {
    const next = [...list];
    const item: Item = {
      ...next[idx],
      [field]: field === "name" || field === "unit" ? value : Number(value),
    };
    if (field === "quantity" || field === "price") {
      item.sum = Math.round(item.quantity * item.price * 100) / 100;
    }
    next[idx] = item;
    setList(next);
  }

  function addRow(list: Item[], setList: (v: Item[]) => void) {
    setList([...list, { position: list.length + 1, name: "", unit: "", quantity: 0, price: 0, sum: 0 }]);
  }

  function removeRow(list: Item[], setList: (v: Item[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  const materialsTotal = materials.reduce((s, m) => s + Number(m.sum || 0), 0);
  const worksTotal = works.reduce((s, w) => s + Number(w.sum || 0), 0);

  async function saveChanges() {
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateEstimate(estimate.id, { materials, works });
      onSaved(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await api.updateEstimate(estimate.id, { materials, works });
      const updated = await api.confirmEstimate(estimate.id);
      onSaved(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
        <Stat label="Матеріалів" value={materials.length} />
        <Stat label="Робіт" value={works.length} />
        <Stat label="Сума матеріалів" value={`${materialsTotal.toLocaleString("uk-UA")} грн`} />
        <Stat label="Сума робіт" value={`${worksTotal.toLocaleString("uk-UA")} грн`} />
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3 mb-4">
          <p className="font-medium mb-1">Потрібна перевірка:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}

      <ItemsTable title="Матеріали" list={materials} setList={setMaterials} addRow={addRow} removeRow={removeRow} updateItem={updateItem} />
      <ItemsTable title="Роботи" list={works} setList={setWorks} addRow={addRow} removeRow={removeRow} updateItem={updateItem} />

      <div className="text-right font-semibold text-[#0b1830] mb-3 text-lg">
        Разом: {(materialsTotal + worksTotal).toLocaleString("uk-UA")} грн
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={() => setShowRaw((v) => !v)} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm">
          {showRaw ? "Сховати сирий текст" : "Подивитися сирий текст"}
        </button>
        <button onClick={reanalyze} disabled={busy} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm">
          Повторити розпізнавання
        </button>
        <button onClick={saveChanges} disabled={busy} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm">
          Зберегти правки
        </button>
        <button onClick={confirm} disabled={busy} className="btn-navy px-5 py-2 rounded text-sm font-medium">
          {busy ? "Обробка..." : "Підтвердити кошторис"}
        </button>
      </div>
      {showRaw && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Сирий текст, розпізнаний з файлу кошторису:</p>
          <pre className="text-xs whitespace-pre-wrap max-h-80 overflow-auto text-gray-700">
            {estimate.raw_text || "Текст відсутній."}
          </pre>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-gray-400 text-xs">{label}</div>
      <div className="font-semibold text-[#0b1830]">{value}</div>
    </div>
  );
}

function ItemsTable({
  title,
  list,
  setList,
  addRow,
  removeRow,
  updateItem,
}: {
  title: string;
  list: Item[];
  setList: (v: Item[]) => void;
  addRow: (list: Item[], setList: (v: Item[]) => void) => void;
  removeRow: (list: Item[], setList: (v: Item[]) => void, idx: number) => void;
  updateItem: (list: Item[], setList: (v: Item[]) => void, idx: number, field: keyof Item, value: string) => void;
}) {
  return (
    <div className="mb-5">
      <h4 className="font-medium mb-2 text-[#0b1830]">{title}</h4>
      <table className="w-full text-sm border border-gray-200 rounded overflow-hidden">
        <thead className="bg-[#0b1830] text-white">
          <tr>
            <th className="px-2 py-2 text-left">№</th>
            <th className="px-2 py-2 text-left">Назва</th>
            <th className="px-2 py-2 text-left">Ед.</th>
            <th className="px-2 py-2 text-left">Кількість</th>
            <th className="px-2 py-2 text-left">Ціна</th>
            <th className="px-2 py-2 text-left">Сума</th>
            <th className="px-2 py-2 text-left">Категорія</th>
            <th className="px-2 py-2 text-left">Уверенность</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((item, idx) => (
            <tr key={idx} className="border-t even:bg-gray-50">
              <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
              <td className="px-1 py-1">
                <input
                  className="w-full px-1 bg-transparent"
                  value={item.name}
                  onChange={(e) => updateItem(list, setList, idx, "name", e.target.value)}
                />
              </td>
              <td className="px-1 py-1 w-16">
                <input
                  className="w-full px-1 bg-transparent"
                  value={item.unit}
                  onChange={(e) => updateItem(list, setList, idx, "unit", e.target.value)}
                />
              </td>
              <td className="px-1 py-1 w-20">
                <input
                  type="number"
                  className="w-full px-1 bg-transparent"
                  value={item.quantity}
                  onChange={(e) => updateItem(list, setList, idx, "quantity", e.target.value)}
                />
              </td>
              <td className="px-1 py-1 w-24">
                <input
                  type="number"
                  className="w-full px-1 bg-transparent"
                  value={item.price}
                  onChange={(e) => updateItem(list, setList, idx, "price", e.target.value)}
                />
              </td>
              <td className="px-2 py-1 w-24 text-right font-medium">{Number(item.sum).toFixed(2)}</td>
              <td className="px-2 py-1 text-xs text-gray-500">{item.category || "—"}</td>
              <td className="px-2 py-1 w-20">
                <ConfidenceBadge value={item.confidence} />
              </td>
              <td className="px-2 py-1 text-center">
                <button onClick={() => removeRow(list, setList, idx)} className="text-red-500">
                  ×
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={9} className="px-2 py-3 text-center text-gray-400">
                Рядків немає
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button onClick={() => addRow(list, setList)} className="text-[#0b1830] text-sm mt-1 hover:underline">
        + Додати рядок вручну
      </button>
    </div>
  );
}

function ConfidenceBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span className="text-gray-300">—</span>;
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? "bg-green-100 text-green-700" : value >= 0.6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`px-1.5 py-0.5 rounded text-xs ${color}`}>{pct}%</span>;
}
