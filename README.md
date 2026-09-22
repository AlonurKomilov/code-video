# Loyihalar — arxitektura

Beshta loyiha, bitta ma'lumot bloki. Har yangi loyiha shu blokni olib yuradi, va blok
manba bilan rozi bo'lmay qolsa, qurish yiqiladi.

## Nima uchun

Bu loyihalar tadqiqot uchun. Tadqiqotda esa *plausible* degan so'z yo'q: raqam yo
o'lchangan, yo sanalgan, yo u umuman raqam emas. Shuning uchun kartadagi to'rt
qismning huquqlari boshqa-boshqa:

| qism | kim yozadi | qanday tekshiriladi |
|---|---|---|
| `sanoq` | **tool** — `tools/sanoq.mjs` manbani o'qiydi | qo'l tegmaydi |
| `uslub` | odam, lekin har satr `sanoq` dagi bitta qiymatga bog'lanadi | qiymat satr matnida turishi shart |
| `stil` | odam — muhit qanday ko'rinadi | yagona erkin maydon |
| `olchov` | **tool** — `tools/olchov.mjs` kadrni o'lchaydi | qo'l tegmaydi |

`uslub` bog'lanishi asosiy mexanizm. Satr shunday yoziladi:

```json
{"gap":"Qo'lda yozilgan 4 poza — CONTACT, DOWN, PASSING, UP — ko'zguda 8 taga aylanadi.",
 "dalil":"jadvallar.PW"}
```

Manbadagi poza soni 4 dan 6 ga chiqsa, `sanoq.jadvallar.PW` 6 bo'ladi, satrdagi 4 unga
mos kelmaydi va `karta/sanoq-bilan-mos` yiqiladi. **Karta jimgina yolg'on bo'lib
qololmaydi** — u yoki manba bilan rozi, yoki qurish to'xtaydi.

## Da'vo va maqsad ikki xil narsa

- **`davolar`** — loyiha *hozir nima ekani* haqidagi va'da. Whiteout OQ; Mushuk RANGLI.
  Buzilsa — regressiya, qurish yiqiladi.
- **`maqsadlar`** — loyiha *qayerga borishi*. Whiteout qiymat oralig'i 90 ga chiqishi
  kerak, hozir 50. Bajarilmagan maqsad nosozlik emas, ish rejasi — va u yashirilmaydi,
  faqat yiqitmaydi.

Ularni aralashtirish birinchi urinishda uchta soxta "yiqilish" berdi.

## O'lchov o'zi ham kalibrlanadi

Har tekshiruv ataylab buzilgan holatini olib yuradi; buzilgan holat ham o'tib ketsa,
tekshiruv `UNPROVEN` bo'ladi va qurish yiqiladi. O'lchov toolining o'ziga ikkita:

- **`olchov/buzilganni-sezadi`** — kadr xiralashtirilganda tekstura **9,6 barobar**
  tushadi; xiralashtirishsiz **1,0**. Ya'ni tool nimani o'lchayotganini biladi.
- **`olchov/kadrdan-mustaqil`** — bu tekshiruv haqiqiy xatoni tutdi. Birinchi variant
  chetlarni faqat **birinchi** kadrdan o'lchardi, va o'sha uchta kadrning o'zi bitta-
  bittalab o'lchanganda javob **19,6 foiz nuqtaga** farq qildi. Shu ikkita xulosani
  buzdi — "Oq Ko'cha va Not A Measurement bir xil qo'l bilan chizilgan" degani o'sha
  artefakt edi. Endi har kadr alohida o'lchanadi va o'rtacha olinadi: farq **0,9**.

Kalibratsiyaning o'zi ham beqaror bo'lishi mumkin: bu tekshiruv avval vaqt bo'yicha
kadr oladigan loyihada turgan edi va bir yugurishda 19,6, keyingisida 5,4 berdi.
Endi u `__frameTo` bilan raqam bo'yicha kadr oladigan loyihada.

## Buyruqlar

```
node tools/sanoq.mjs <fayl...>        # manbadan sanaydi
node tools/olchov.mjs <fayl> <t...>   # kadrdan o'lchaydi
node tools/karta.mjs                  # kartalar manba bilan rozimi
node tools/karta.mjs refresh          # sanoq va o'lchovni qaytadan to'ldiradi
node test/run.mjs                     # hammasi + kalibratsiya
```

## Oltita raqam

Renderer bilmaydigan oltita raqam — shuning uchun Canvas bilan chizilgan mushukni SDF
bilan yechilgan ko'cha bilan solishtirish mumkin.

| raqam | nima |
|---|---|
| `qiymat` | eng qorong'i va eng yorug' (2% va 98% kvantil), 0–255 |
| `toyinganlik` | o'rtacha to'yinganlik, % |
| `chizilganlik` | qattiq chet (Δluma > 0,16) ulushi, barcha chetlarga nisbatan |
| `tekstura` | 3×3 blurdan keyin qolgan o'rtacha energiya, 0–255 shkalada |
| `siyoh` | luma < 0,15 bo'lgan piksellar ulushi, % |
| `palitra` | median-cut, 6 rang, maydon ulushi bilan |

Median-cut ataylab: k-means boshlang'ich nuqtaga qarab har safar boshqa javob berardi,
va har safar boshqa javob beradigan o'lchov o'lchov emas.
