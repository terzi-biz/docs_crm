#!/usr/bin/env python3
"""Builds DOCX templates (with docxtemplater {tag} placeholders) used by the
document generator. Run once: python3 server/scripts/build_templates.py
"""
import os
from docx import Document
from docx.shared import Pt, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "templates")
os.makedirs(OUT_DIR, exist_ok=True)


def add_heading(doc, text, size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER):
    p = doc.add_paragraph()
    p.alignment = align
    r = p.add_run(text)
    r.bold = bold
    r.font.size = Pt(size)
    return p


def add_para(doc, text, size=11, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT):
    p = doc.add_paragraph()
    p.alignment = align
    r = p.add_run(text)
    r.bold = bold
    r.font.size = Pt(size)
    return p


# ---------------------------------------------------------------------------
# CONTRACT (Договір підряду)
# ---------------------------------------------------------------------------
doc = Document()
section = doc.sections[0]
section.left_margin = Mm(20)
section.right_margin = Mm(15)

add_heading(doc, "ДОГОВІР ПІДРЯДУ № {contract_number}", size=14)
add_para(doc, "м. Одеса" + " " * 40 + "«{contract_day}» {contract_month} {contract_year} р.")
doc.add_paragraph()

add_para(
    doc,
    "Фізична особа-підприємець Терзі Василь Васильович, ІПН/ЄДРПОУ 2818915836, "
    "що діє на підставі Виписки з ЄДР 25320000000005341 (надалі — «Виконавець»), "
    "з однієї сторони, та {client_name}, паспорт №{client_passport} "
    "(надалі — «Замовник»), з другої сторони, керуючись статтями 837–886 "
    "Цивільного кодексу України, уклали цей Договір підряду (надалі — «Договір») про таке:"
)

add_heading(doc, "1. ПРЕДМЕТ ДОГОВОРУ", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(
    doc,
    "1.1. Виконавець зобов'язується за завданням Замовника виконати роботи: "
    "{work_type} (надалі — «Роботи»), на Об'єкті Замовника за адресою: {object_address}."
)
add_para(
    doc,
    "1.2. Вид, обсяг та вартість Робіт визначаються Кошторисом (Додаток № 1), "
    "який є невід'ємною частиною цього Договору."
)
add_para(
    doc,
    "1.3. Матеріали закуповуються Виконавцем за рахунок Замовника відповідно до "
    "Кошторису. Вартість матеріалів відображається у Кошторисі окремим рядком."
)
add_para(
    doc,
    "1.4. Якість Робіт повинна відповідати чинним ДБН, ДСТУ та технічним умовам "
    "для відповідного виду робіт."
)
add_para(
    doc,
    "1.5 Площа об'єкта Замовника за адресою: {object_address}, становить: "
    "{object_area} м², товщина стяжки: {screed_thickness}, технологія: {work_type}."
)

add_heading(doc, "2. ЦІНА ДОГОВОРУ ТА ПОРЯДОК РОЗРАХУНКІВ", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(
    doc,
    "2.1. Загальна сума Договору складається з вартості робіт та вартості "
    "матеріалів і визначається Кошторисом (Додаток № 1). Загальна вартість: "
    "{total_amount} грн ({total_amount_words})."
)

add_para(doc, "{#is_advance}")
add_para(doc, "2.2. Розрахунки здійснюються у два етапи:")
add_para(
    doc,
    "Етап 1 — Авансовий платіж (бронювання дати). Замовник сплачує авансовий "
    "платіж у розмірі {advance_payment} грн не пізніше 3-х банківських днів з "
    "дня підписання Договору. Авансовий платіж резервує дату початку Робіт. "
    "Виконавець приступає до планування виконання Робіт виключно після "
    "фактичного надходження авансового платежу."
)
add_para(
    doc,
    "Етап 2 — Оплата вартості виконаних робіт. Замовник сплачує вартість Робіт "
    "відповідно до Кошторису у розмірі {final_payment} грн протягом 1 (одного) "
    "банківського дня по факту виконаних робіт. У разі прострочення оплати "
    "Замовник сплачує пеню 0,3% від суми заборгованості за кожен день "
    "прострочення (ст. 231 ЦКУ)."
)
add_para(doc, "{/is_advance}")

add_para(doc, "{#is_full}")
add_para(
    doc,
    "2.2. Розрахунки здійснюються у повному обсязі (100% оплата). Замовник "
    "сплачує повну вартість Робіт та матеріалів у розмірі {full_payment_amount} "
    "грн не пізніше 3-х банківських днів з дня підписання Договору. Виконавець "
    "приступає до виконання Робіт виключно після фактичного надходження оплати."
)
add_para(doc, "{/is_full}")

add_para(
    doc,
    "2.3. Всі розрахунки здійснюються у гривні. Датою оплати є дата фактичного "
    "надходження коштів на р/р Виконавця."
)
add_para(
    doc,
    "2.4. Авансовий платіж є завдатком у розумінні ст. 570 ЦК України. У разі "
    "відмови Замовника від Договору без поважних причин – завдаток не "
    "повертається. У разі відмови Виконавця – повертається у повному розмірі "
    "(ст. 571 ЦК України)."
)

add_heading(doc, "3. ПОРЯДОК ТА СТРОКИ ВИКОНАННЯ РОБІТ", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(
    doc,
    "3.1. Орієнтовна дата початку Робіт узгоджується Сторонами після сплати "
    "авансу, в період 3 (трьох) робочих днів."
)
add_para(doc, "3.2. Строк виконання Робіт: {work_duration} з дати фактичного початку виконання.")
add_para(
    doc,
    "3.3. Виконавець має право продовжити строк не більше ніж на 5 календарних "
    "днів у зв'язку з технічними особливостями Об'єкту, виявленими "
    "безпосередньо на місці."
)

add_heading(doc, "4. ПРИЙМАННЯ РЕЗУЛЬТАТІВ ВИКОНАНИХ РОБІТ", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(
    doc,
    "4.1. Після завершення Робіт Виконавець повідомляє Замовника про "
    "готовність до приймання. Якщо протягом 3 (трьох) робочих днів Замовник "
    "не з'явився і не надав письмових зауважень — Роботи вважаються "
    "прийнятими (ст. 853 ЦКУ)."
)

add_heading(doc, "5. ЯКІСТЬ РОБІТ ТА ГАРАНТІЙНІ ЗОБОВ'ЯЗАННЯ", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(
    doc,
    "5.1. Гарантійний строк на виконані Роботи — з дати підписання Акта "
    "приймання-передачі, за умови дотримання технології та правил "
    "експлуатації."
)

add_heading(doc, "6. ВІДПОВІДАЛЬНІСТЬ СТОРІН ТА ФОРС-МАЖОР", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(
    doc,
    "6.1. У разі прострочення платежу Замовник сплачує пеню 0,3% від суми "
    "простроченого платежу за кожен день прострочення (ст. 231 ЦКУ)."
)
add_para(
    doc,
    "6.2. Сторони звільняються від відповідальності за невиконання "
    "зобов'язань внаслідок обставин непереборної сили (форс-мажор)."
)

add_heading(doc, "7. ІНШІ УМОВИ", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(
    doc,
    "7.1. Договір складено українською мовою у двох примірниках однакової "
    "юридичної сили. Невід'ємною частиною Договору є Додаток № 1 — Кошторис."
)

doc.add_paragraph()
add_heading(doc, "8. РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН", align=WD_ALIGN_PARAGRAPH.LEFT)
add_para(doc, "ВИКОНАВЕЦЬ", bold=True)
add_para(doc, "ФОП Терзі Василь Васильович")
add_para(doc, "ІПН/ЄДРПОУ 2818915836")
add_para(doc, "м. Одеса, площа 10-го Квітня, 1")
add_para(doc, "р/р UA363220010000026003350115216, АТ «УНІВЕРСАЛ БАНК»")
add_para(doc, "тел.: +380975437592")
add_para(doc, "________________________________ (підпис)")
doc.add_paragraph()
add_para(doc, "ЗАМОВНИК", bold=True)
add_para(doc, "{client_name}")
add_para(doc, "Паспорт: {client_passport}")
add_para(doc, "Адреса об'єкту: {object_address}")
add_para(doc, "Тел: {client_phone}")
add_para(doc, "E-mail: {client_email}")
add_para(doc, "________________________________ (підпис)")

doc.save(os.path.join(OUT_DIR, "contract.docx"))

# ---------------------------------------------------------------------------
# ESTIMATE (Кошторис) — Додаток №1
# ---------------------------------------------------------------------------
doc = Document()
section = doc.sections[0]
section.left_margin = Mm(15)
section.right_margin = Mm(15)

add_heading(doc, "ДОДАТОК № 1 — КОШТОРИС", size=14)
add_para(
    doc,
    "до Договору підряду № {contract_number} від «{contract_day}» {contract_month} {contract_year} р.",
    align=WD_ALIGN_PARAGRAPH.CENTER,
)
add_para(doc, "Замовник: {client_name}", align=WD_ALIGN_PARAGRAPH.CENTER)
add_para(doc, "Об'єкт / Адреса: {object_address}", align=WD_ALIGN_PARAGRAPH.CENTER)
add_para(doc, "Площа (орієнтовна): {object_area} м²", align=WD_ALIGN_PARAGRAPH.CENTER)
doc.add_paragraph()

table = doc.add_table(rows=1, cols=6)
table.style = "Table Grid"
hdr = table.rows[0].cells
headers = ["№", "Найменування робіт / матеріалів", "Од. вим.", "К-ть", "Ціна, грн", "Сума, грн"]
for i, h in enumerate(headers):
    hdr[i].text = h

row = table.add_row().cells
row[0].merge(row[5])
row[0].text = "МАТЕРІАЛИ"

mat_row = table.add_row().cells
mat_row[0].text = "{#materials}{position}"
mat_row[1].text = "{name}"
mat_row[2].text = "{unit}"
mat_row[3].text = "{quantity}"
mat_row[4].text = "{price}"
mat_row[5].text = "{sum}{/materials}"

mat_total = table.add_row().cells
mat_total[0].merge(mat_total[4])
mat_total[0].text = "Разом за матеріали:"
mat_total[5].text = "{materials_total}"

works_row = table.add_row().cells
works_row[0].merge(works_row[5])
works_row[0].text = "РОБОТИ"

work_row = table.add_row().cells
work_row[0].text = "{#works}{position}"
work_row[1].text = "{name}"
work_row[2].text = "{unit}"
work_row[3].text = "{quantity}"
work_row[4].text = "{price}"
work_row[5].text = "{sum}{/works}"

work_total = table.add_row().cells
work_total[0].merge(work_total[4])
work_total[0].text = "Разом вартість робіт:"
work_total[5].text = "{works_total}"

grand_total = table.add_row().cells
grand_total[0].merge(grand_total[4])
grand_total[0].text = "РАЗОМ (грн):"
grand_total[5].text = "{grand_total}"

pay_row = table.add_row().cells
pay_row[0].merge(pay_row[4])
pay_row[0].text = "{payment_label}"
pay_row[5].text = "{payment_amount}"

doc.add_paragraph()
add_para(
    doc,
    "Примітки: 1. Обсяг є орієнтовним. Зміна понад 5% оформлюється додатковою "
    "угодою. Фактична вартість визначається за підписаним Актом "
    "приймання-передачі.",
)
add_para(
    doc,
    "2. Приховані дефекти основи, виявлені після початку Робіт, узгоджуються "
    "окремою угодою.",
)

doc.add_paragraph()
add_para(doc, "ВИКОНАВЕЦЬ", bold=True)
add_para(doc, "ФОП Терзі В.В., м. Одеса, площа 10-го Квітня, 1")
add_para(doc, "р/р UA363220010000026003350115216, АТ «УНІВЕРСАЛ БАНК»")
add_para(doc, "ЄДРПОУ: 2818915836, тел. +380975437592")
add_para(doc, "________________________________ (підпис)")
doc.add_paragraph()
add_para(doc, "ЗАМОВНИК:", bold=True)
add_para(doc, "{client_name}")
add_para(doc, "________________________________ (підпис)")
add_para(doc, "Дата: «{contract_day}» {contract_month} {contract_year} р.")

doc.save(os.path.join(OUT_DIR, "estimate.docx"))

# ---------------------------------------------------------------------------
# INVOICE (Рахунок на оплату)
# ---------------------------------------------------------------------------
doc = Document()
section = doc.sections[0]
section.left_margin = Mm(15)
section.right_margin = Mm(15)

add_heading(doc, "Рахунок на оплату № {invoice_number} від {invoice_date}", size=14)
add_para(doc, "Постачальник: ФОП Терзі Василь Васильович")
add_para(doc, "ЄДРПОУ: 2818915836")
add_para(doc, "Банк: Акціонерне товариство УНІВЕРСАЛ БАНК")
add_para(doc, "IBAN: UA363220010000026003350115216")
add_para(doc, "Покупець: {client_name}")
add_para(doc, "Призначення платежу: {payment_purpose}")
doc.add_paragraph()

table = doc.add_table(rows=1, cols=6)
table.style = "Table Grid"
hdr = table.rows[0].cells
headers = ["№", "Опис", "Од. Вим.", "Кількість", "Ціна, грн", "Сума, грн"]
for i, h in enumerate(headers):
    hdr[i].text = h

row = table.add_row().cells
row[0].text = "1"
row[1].text = "{work_description}"
row[2].text = "послуга"
row[3].text = "1"
row[4].text = "{invoice_amount}"
row[5].text = "{invoice_amount}"

total_row = table.add_row().cells
total_row[0].merge(total_row[4])
total_row[0].text = "Всього:"
total_row[5].text = "{invoice_amount}"

doc.add_paragraph()
add_para(doc, "Сума прописом: {invoice_amount_words}.")
add_para(doc, "________________________________ Дата: «{contract_day}» {contract_month} {contract_year} р.")
add_para(doc, "(підпис)")
add_para(doc, "Виписав: ФОП Терзі Василь Васильович")

doc.save(os.path.join(OUT_DIR, "invoice.docx"))

print("Templates written to", OUT_DIR)
