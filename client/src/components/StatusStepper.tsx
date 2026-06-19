export const STATUSES = [
  "Новий об'єкт",
  "Дані заповнені",
  "Кошторис завантажено",
  "Кошторис розпізнано",
  "Кошторис перевірено",
  "Документи створено",
  "Надіслано клієнту",
  "Договір підписано",
  "Оплачено",
  "Роботи виконані",
  "Закрито",
];

export default function StatusStepper({ status }: { status: string }) {
  const currentIdx = STATUSES.indexOf(status);
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div
            key={s}
            className={
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border " +
              (active
                ? "bg-[#0b1830] text-white border-[#0b1830]"
                : done
                ? "bg-[#c9a44c]/15 text-[#0b1830] border-[#c9a44c]/40"
                : "bg-white text-gray-400 border-gray-200")
            }
          >
            <span
              className={
                "w-4 h-4 rounded-full flex items-center justify-center text-[10px] " +
                (active
                  ? "bg-[#c9a44c] text-[#0b1830]"
                  : done
                  ? "bg-[#c9a44c] text-white"
                  : "bg-gray-200 text-gray-500")
              }
            >
              {done ? "✓" : idx + 1}
            </span>
            {s}
          </div>
        );
      })}
    </div>
  );
}
