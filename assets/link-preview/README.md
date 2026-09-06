# Link Preview Thumbnail

Taruh thumbnail khusus link preview Saweria di folder ini dengan nama:

`assets/link-preview/saweria.jpg`

Ketentuan:
- JPEG/JPG (`image/jpeg`)
- Rasio 1:1
- Disarankan 600x600 px
- Ukuran di bawah 100 KB

Bot membaca file ini dengan `fs.readFileSync()` dan mengirimkannya sebagai `jpegThumbnail` pada `linkPreview` Baileys.

Jika file belum ada, command `allmenu` akan gagal saat mengirim preview agar thumbnail default website tidak dipakai diam-diam.
