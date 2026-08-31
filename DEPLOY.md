# BUKUR WORLD — Faza 1: Publikimi i Website-it

Ky udhëzues të çon nga projekti lokal te një website **live** me:
- ✅ Transfer bankar
- ✅ Pagesë në dorëzim
- ✅ Porosi reale + email konfirmimi

---

## Para se të fillosh

Mblidh këto nga klienti:

| Çfarë | Shembull |
|-------|----------|
| Domain | `bukurworld.com` |
| IBAN bankar | Llogaria e biznesit |
| Emri i bankës | Raiffeisen, NLB, etj. |
| Email për porosi | `orders@bukurworld.com` |
| Llogari Resend | [resend.com](https://resend.com) (falas për fillim) |

---

## Hapi 1 — Backend (Medusa) në Render

1. Krijo llogari në [render.com](https://render.com)
2. Lidhe GitHub repo-n (ose upload projektin)
3. Kliko **New → Blueprint** dhe zgjidh `render.yaml` nga repo
4. Ose manualisht:
   - **Web Service** → root: `my-medusa-store`
   - Build: `npm install && npm run build`
   - Start: `npm run start`
   - Shto **PostgreSQL** database

5. Vendos variablat e mjedisit (Settings → Environment):

```
STORE_CORS=https://bukurworld.com,https://www.bukurworld.com
ADMIN_CORS=https://bukur-api.onrender.com
AUTH_CORS=https://bukur-api.onrender.com
MEDUSA_DEFAULT_REGION_ID=reg_01KJGNNB7F58NMWSGDHYTHGR0Q
RESEND_API_KEY=re_xxxxx
RESEND_FROM=BUKUR WORLD <orders@bukurworld.com>
BANK_HOLDER=BUKUR WORLD
BANK_IBAN=XX00 0000 0000 0000 0000
BANK_NAME=Raiffeisen Bank Kosovo
```

6. Pas deploy-it, URL-ja e backend-it do jetë diçka si:
   `https://bukur-medusa.onrender.com`

7. Hap Medusa Admin: `https://bukur-medusa.onrender.com/app`
   - Krijo admin user nëse është hera e parë
   - Verifiko produktet dhe çmimet

---

## Hapi 2 — Frontend në Vercel

1. Krijo llogari në [vercel.com](https://vercel.com)
2. **Import Project** nga GitHub
3. Root directory: projekti kryesor (jo `my-medusa-store`)
4. Framework: **Create React App** (auto-detect)

5. Vendos Environment Variables:

```
REACT_APP_MEDUSA_URL=https://bukur-medusa.onrender.com
REACT_APP_MEDUSA_PUBLISHABLE_KEY=pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549
REACT_APP_MEDUSA_REGION_ID=reg_01KJGNNB7F58NMWSGDHYTHGR0Q
REACT_APP_BANK_HOLDER=BUKUR WORLD
REACT_APP_BANK_IBAN=XX00 0000 0000 0000 0000
REACT_APP_BANK_NAME=Raiffeisen Bank Kosovo
REACT_APP_BANK_SWIFT=RBKOXKPR
```

6. Deploy → merr URL si `https://bukur-world.vercel.app`

7. **Përditëso STORE_CORS** në Render me URL-n e Vercel-it (ose domain-in final)

---

## Hapi 3 — Domain (opsional por rekomandohet)

1. Bli domain nga Namecheap, GoDaddy, ose Cloudflare
2. Në Vercel: Settings → Domains → shto `bukurworld.com`
3. Në DNS provider, shto rekordet që tregon Vercel
4. Përditëso `STORE_CORS` në backend me domain-in e ri

---

## Hapi 4 — Testo para se t'ia japësh klientit

- [ ] Faqja hapet në telefon dhe desktop
- [ ] Produktet shfaqen nga Medusa (jo vetëm statike)
- [ ] Shton produkt në shportë
- [ ] Checkout me **Transfer Bankar** → shfaq IBAN
- [ ] Checkout me **Para në Dorëzim** → porosia regjistrohet
- [ ] Email konfirmimi arrin te klienti
- [ ] Porosia shfaqet në Medusa Admin

---

## Si funksionon pagesa (Faza 1)

### Transfer Bankar
1. Klienti zgjedh "Transfer Bankar"
2. Shfaqen të dhënat e bankës (IBAN)
3. Pas porosisë, merr numrin e referencës `#xxxxx`
4. Transferon shumën në bankë me atë referencë
5. **Ju** konfirmoni pagesën manualisht dhe dërgoni porosinë

### Para në Dorëzim
1. Klienti paguan kur merr paketën
2. Porosia regjistrohet direkt

---

## Zhvillim lokal

```bash
# Terminal 1 — Backend
cd my-medusa-store
npm run dev

# Terminal 2 — Frontend
cd ..
cp .env.example .env.local
# Plotëso .env.local me vlerat lokale
npm start
```

---

## Kosto e vlerësuar

| Shërbimi | Kosto |
|----------|-------|
| Vercel (frontend) | Falas |
| Render (backend + DB) | ~$14–25/muaj |
| Domain | ~€10/vit |
| Resend email | Falas deri 3,000/muaj |

---

## Faza 2 (më vonë)

- Stripe për pagesë me kartelë online
- Panel admin i thjeshtuar për klientin

---

## Ndihmë e shpejtë

**Produktet nuk shfaqen?**
→ Kontrollo `REACT_APP_MEDUSA_URL` dhe që backend-i është online

**Porosia nuk regjistrohet?**
→ Kontrollo `STORE_CORS` përfshin URL-n e frontend-it

**Email nuk vjen?**
→ Kontrollo `RESEND_API_KEY` dhe verifiko domain-in në Resend

**IBAN i gabuar në checkout?**
→ Përditëso `REACT_APP_BANK_IBAN` në Vercel dhe redeploy
