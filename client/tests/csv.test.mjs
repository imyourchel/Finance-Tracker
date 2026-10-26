// Dijalankan dengan: npm test (folder client)
import assert from "assert";
import { parseCsv, detectDelimiter, parseAmountId, parseDateId, detectLayout, buildRows } from "../src/components/data/csv.js";
const today = new Date("2026-10-26T10:00:00+07:00");
// angka
const A = (s) => { const r = parseAmountId(s); return r.value * (r.sign || 1); };
const cases = [["1.250.000,00",1250000],["1,250,000.00",1250000],["Rp 54.000",54000],["-54.000",-54000],["(54.000)",-54000],["54,000.00 DB",-54000],["6,500,000.00 CR",6500000],["54.5",54.5],["54,50",54.5],["100.000",100000],["100,000",100000],["1.000.000",1000000],["'15000",15000],["IDR 2.500.000,50",2500000.5],["25.000-",-25000],["",0],["abc",0]];
for (const [s, v] of cases) assert.equal(A(s), v, s);
// tanggal
const D = (s, o) => parseDateId(s, { today, ...o });
assert.equal(D("05/10/2026"), "2026-10-05"); assert.equal(D("05-10-26"), "2026-10-05"); assert.equal(D("2026-10-05"), "2026-10-05");
assert.equal(D("'05/10"), "2026-10-05"); assert.equal(D("15/12"), "2025-12-15"); assert.equal(D("15/12", { yearHint: 2026 }), "2026-12-15");
assert.equal(D("01 Okt 2026"), "2026-10-01"); assert.equal(D("1 Oktober 2026 10:23"), "2026-10-01"); assert.equal(D("01-Oct-26"), "2026-10-01");
assert.equal(D("Oct 1, 2026"), "2026-10-01"); assert.equal(D("10/25/2026"), "2026-10-25"); assert.equal(D("31/02/2026"), null); assert.equal(D("Saldo Awal"), null);
assert.equal(D("2026-10-05 14:22:10"), "2026-10-05"); assert.equal(D("05.10.2026"), "2026-10-05");
// delimiter
assert.equal(detectDelimiter('a;b;c\n1;"x;y";3'), ";"); assert.equal(detectDelimiter("a,b,c\n1,2,3"), ","); assert.equal(detectDelimiter("a\tb\tc\n1\t2\t3"), "\t");
// csv quotes, BOM, multiline
const p = parseCsv('﻿Tanggal,Keterangan,Jumlah\n05/10/2026,"Bayar ""kopi"", enak",18000\n06/10/2026,"baris\nbaru",5000\n');
assert.deepEqual(p.rows[1], ["05/10/2026", 'Bayar "kopi", enak', "18000"]); assert.equal(p.rows[2][1], "baris\nbaru");
const run = (text, name) => { const { rows } = parseCsv(text); const L = detectLayout(rows); const B = buildRows(rows, L, L.mapping, { today }); void (`${name}: bank=${L.bank.name} mode=${L.mapping.mode} year=${L.yearHint} rows=${B.rows.length} skipped=${B.skipped.length}`, B.rows.map(r => `${r.date} ${r.type} ${r.amount} "${r.description}"`)); return { L, B }; };
// BCA klikBCA (ringkasan atas & bawah, jumlah dengan DB/CR)
let r = run(`No. rekening : 1234567890
Nama : HIZKIA
Periode : 01/10/2026 - 26/10/2026
Kode Mata Uang : Rp

Tanggal Transaksi,Keterangan,Cabang,Jumlah,,Saldo
'01/10,TRSF E-BANKING CR 0110/FTSCY/WS95031 6500000.00 GAJI PT MAJU,0000,"6,500,000.00",CR,"7,000,000.00"
'05/10,TRSF E-BANKING DB 0510/FTSCY/WS95051 54000.00 NETFLIX,0000,"54,000.00",DB,"6,946,000.00"
'12/10,KARTU DEBIT INDOMARET,0998,"125,500.00",DB,"6,820,500.00"
'15/10,BIAYA ADM,0000,"10,000.00",DB,"6,810,500.00"

Saldo Awal,,,"500,000.00"
Mutasi Kredit,,,"6,500,000.00",2
Mutasi Debet,,,"189,500.00",3
Saldo Akhir,,,"6,810,500.00"`, "BCA");
assert.equal(r.L.bank.id, "bca"); assert.equal(r.B.rows.length, 4); assert.equal(r.B.rows[0].type, "income"); assert.equal(r.B.rows[1].type, "expense"); assert.equal(r.B.rows[2].amount, 125500);
// BCA dengan kolom DB/CR bernama
r = run(`Tanggal,Keterangan,Cabang,Jumlah,DB/CR,Saldo
05/10/2026,NETFLIX,0000,54000.00,DB,100000.00
06/10/2026,TRANSFER MASUK,0000,"1,000,000.00",CR,1100000.00`, "BCA2");
assert.equal(r.L.mapping.mode, "flag"); assert.deepEqual(r.B.rows.map(x => x.type), ["expense", "income"]);
// BRI
r = run(`Tanggal Transaksi;Uraian Transaksi;Teller;Debet;Kredit;Saldo
05/10/26 08:12:33;ATM BERSAMA TARIK TUNAI;8888;500.000,00;0,00;1.500.000,00
07/10/26 10:00:00;TRF DARI BUDI;8888;0,00;250.000,00;1.750.000,00`, "BRI");
assert.equal(r.L.bank.id, "bri"); assert.equal(r.L.mapping.mode, "split"); assert.deepEqual(r.B.rows.map(x => [x.type, x.amount]), [["expense", 500000], ["income", 250000]]);
// Mandiri
r = run(`Tanggal,Keterangan,Dana Masuk (IDR),Dana Keluar (IDR),Saldo (IDR)
01 Okt 2026 09:00,Gaji,"6.500.000,00","0,00","6.500.000,00"
02 Okt 2026 12:30,QRIS Kopi Kenangan,"0,00","25.000,00","6.475.000,00"`, "Mandiri");
assert.equal(r.L.bank.id, "mandiri"); assert.deepEqual(r.B.rows.map(x => [x.date, x.type, x.amount]), [["2026-10-01", "income", 6500000], ["2026-10-02", "expense", 25000]]);
// BNI
r = run(`Tanggal Transaksi|Uraian Transaksi|Tipe|Nominal|Saldo
05/10/2026|TRANSFER KE ANDI|D|150.000,00|850.000,00
06/10/2026|BUNGA|K|1.234,56|851.234,56`, "BNI");
assert.equal(r.L.bank.id, "bni"); assert.deepEqual(r.B.rows.map(x => [x.type, x.amount]), [["expense", 150000], ["income", 1234.56]]);
// Jago
r = run(`Date & Time,Source/Destination,Transaction Details,Notes,Amount,Balance
2026-10-05 10:11,Spotify,Payment,,-54.990,945.010
2026-10-06 09:00,Budi,Incoming transfer,patungan,+120.000,1.065.010`, "Jago");
assert.equal(r.L.bank.id, "jago"); assert.deepEqual(r.B.rows.map(x => [x.type, x.amount]), [["expense", 54990], ["income", 120000]]); assert(r.B.rows[1].description.includes("patungan"));
// Template DailyTrack
r = run(`﻿Tanggal;Keterangan;Jenis;Nominal
01/10/2026;Gaji Oktober;Pemasukan;6500000
02/10/2026;Kopi;Pengeluaran;18000`, "Template");
assert.equal(r.L.bank.id, "dailytrack"); assert.deepEqual(r.B.rows.map(x => x.type), ["income", "expense"]);
// Tanpa judul
r = run(`05/10/2026;Kopi;-18000\n06/10/2026;Gaji;6500000`, "Tanpa judul");
assert.equal(r.B.rows.length, 2); assert.deepEqual(r.B.rows.map(x => x.type), ["expense", "income"]);
void ("ALL OK");
