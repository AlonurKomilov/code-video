# Kod bilan chizilgan filmlar — va ularning o'lchovi

Beshta qisqa asar, bittasi WebGL masofa maydonida, to'rttasi Canvas ustida. Va
ularning yonida ikkita narsa, ular aslida asosiy narsa:

- **har asar o'zining tekshiruv to'plamini olib yuradi**, va har tekshiruv ataylab
  buzilgan holatini ham olib yuradi;
- **har asar bir xil ma'lumot blokini olib yuradi**, va blok manba bilan rozi
  bo'lmay qolsa, qurish yiqiladi.

Bu bezak emas. Butun loyihaning markaziy da'vosi shu: **o'tayotgan, lekin hech
narsani ushlab turmaydigan tekshiruv — eng yomon tekshiruv**, chunki u ishonch
beradi va hech narsa qaytarmaydi. Shuning uchun har tekshiruv o'zini buzilgan
holatga qarshi isbotlaydi; isbotlay olmasa `UNPROVEN` bo'ladi va qurish to'xtaydi.

## Nima bor

| papka | nima | tekshiruv |
|---|---|---|
| `oq-kocha/` | 15,6 s film. Chizilgan kadr yo'q: 16 poza JSON'da, rasm har pikselda masofa maydonini nurlab yechiladi. Ikki uslub — `oq-qalam` va `tekis-cel` | **41** |
| `loyihalar/` | Arxitektura: manbani sanaydigan va kadrni o'lchaydigan toollar, beshta karta, katalog generatori | **14** |
| `whiteout/` | 4 poza qo'lda yozilgan, ko'zguda 8 ta, 3·2·1·2 varaqasi. **Oq Ko'chaning otasi** — o'sha varaqa, boshqa mashina | karta |
| `bir-tomchi/` | 8 sahna × 9 s, kadrda 379 chizish buyrug'i — eng zichi | karta |
| `mushuk/` | Mushuk uchta yo'l bilan, shahar halftone bilan; bosilganda javob beradi | karta |
| `not-a-measurement/` | 8 kesim, butun film 39 chizish buyrug'ida | karta |
| `masofa-maydoni/` | SDF qumloq — primitivlar, birlashmalar, marching | — |

## Nega bu tadqiqot

Ko'z bilan ko'rib bo'lmaydigan narsalar bu yerda **topildi**, va har biri
o'lchovning o'zidan chiqdi:

- Rim atamasi polni «mendan burilayotgan yuza» deb o'qidi va **yerni oqqa
  aylantirdi**: yo'l 0,61 deb yozilgan, 250 o'lchandi. Har ko'cha kadrining 15% i
  o'chirilgan yo'l edi.
- Filmni arzon qilgan chegaralash (`uBound`) **soyani buzardi**: maydon qobiqda
  jarlikka uchraydi, yumshoq soya jarlikni yuza deb o'qiydi. Tejash birinchi kundan
  o'lchangan; rasmga ta'siri hech qachon.
- **Ko'cha yo'lovchidan qochib ketardi.** Bitta ishora: 1,23 birlik yurganda bino
  24,35 dan 25,91 ga uzoqlashardi.
- `contact-shadow` tekshiruvi boshi ustidagi qatorlarni o'qirdi va ochiq qorning
  yorqinligini — **254,95 / 255** — «oyoq ostida shuncha daraja qorong'i» deb
  hisobotga berardi. Kontakt soyasi 255 daraja chuqur bo'lolmaydi.
- `bounds-save-work` **chuqurlikni o'qib kelgan**, va zond to'yingan edi: `2,85×`
  hech qachon o'lchov emas, quyi chegara edi. Haqiqiysi **3,72×**.
- O'lchov tooli chetlarni faqat **birinchi** kadrdan olardi, va shu asosda chop
  etilgan xulosa noto'g'ri chiqdi. Xulosa qaytarib olindi.

Ro'yxat uzun, va u qasddan uzun: bu loyihaning haqiqiy natijasi — **o'tib ketgan,
lekin ko'r bo'lgan mezonlar ro'yxati**.

## Ishga tushirish

```bash
cd oq-kocha  && npm i && npm run build && npm run audit   # 41 tekshiruv
cd loyihalar && npm i && node test/run.mjs                # 14 tekshiruv
cd loyihalar && node tools/karta.mjs                      # kartalar manba bilan rozimi
cd loyihalar && node tools/katalog.mjs out.html           # katalog sahifasi
```

Render qilingan video va ovoz fayllari bu yerda saqlanmaydi — ularni kod qaytadan
yasaydi.
