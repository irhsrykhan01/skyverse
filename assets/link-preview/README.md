# Link Preview Thumbnail

Taruh thumbnail khusus link preview Saweria di folder ini dengan nama:

`assets/link-preview/saweria.jpg`

Ketentuan:
- JPEG/JPG (`image/jpeg`)
- Rasio 1:1
- Ukuran di bawah 100 KB

Bot membaca file ini langsung dengan `fs.readFileSync()` dan mengirimkannya sebagai `thumbnail` pada `contextInfo.externalAdReply` Baileys.

Tidak ada proses kompresi, resize, download URL, `sharp`, atau `axios` untuk sistem thumbnail ini.
