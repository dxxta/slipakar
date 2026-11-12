import { LandingDictionary } from './content.types';

export const contentId: LandingDictionary = {
  language: 'id',
  languageName: 'Bahasa Indonesia',
  home: {
    metadata: {
      title: 'Slipakar — Email massal personal yang dapat di-host sendiri',
      description: 'Kirim email massal personal melalui server SMTP sendiri, dengan lampiran PDF per penerima seperti slip gaji.',
      path: '/id',
    },
    nav: { how: 'Cara kerja', features: 'Fitur', signIn: 'Masuk' },
    hero: {
      title: 'Email personal, dikirim dari infrastruktur Anda sendiri.',
      description: 'Slipakar membantu tim HR, keuangan, dan operasional mengirim email massal melalui server SMTP perusahaan, dengan PDF personal opsional untuk setiap penerima.',
      signIn: 'Masuk',
      selfHost: 'Panduan self-hosting',
      connectionStatus: { connected: 'Terhubung', disconnected: 'Terputus', checking: 'Memeriksa' },
    },
    audience: {
      title: 'Untuk pekerjaan yang harus menjangkau setiap orang secara personal.',
      items: ['Tim HR yang mengirim slip gaji dan pemberitahuan karyawan', 'Tim keuangan yang membagikan dokumen khusus untuk tiap penerima', 'Tim operasional yang mengirim pembaruan dari spreadsheet'],
    },
    how: {
      title: 'Dari spreadsheet menjadi kampanye dalam empat langkah.',
      steps: [
        { title: 'Unggah', body: 'Gunakan data penerima dari CSV, XLSX, atau JSON.' },
        { title: 'Petakan', body: 'Hubungkan kolom file dengan placeholder di template email dan PDF.' },
        { title: 'Pratinjau', body: 'Periksa hasil personalisasi sebelum kampanye dikirim.' },
        { title: 'Kirim', body: 'Antrekan kampanye dan pantau status pengiriman tiap penerima.' },
      ],
    },
    features: {
      title: 'Perangkat untuk pengiriman massal yang terukur.',
      items: [
        { title: 'Proyek dan SMTP', body: 'Kelola koneksi SMTP dan sumber daya kampanye per proyek. Kredensial dienkripsi saat tersimpan.' },
        { title: 'Template email aman', body: 'Personalisasi pesan dengan kolom {{placeholder}} sederhana. Teks template diganti, tidak dievaluasi sebagai kode.' },
        { title: 'Unggahan dan pemetaan field', body: 'Gunakan data penerima CSV, XLSX, atau JSON, lalu petakan kolom ke field yang digunakan template.' },
        { title: 'Pembuat template PDF', body: 'Susun tata letak PDF personal dengan node teks, tabel, gambar, dan pemisah.' },
        { title: 'Kampanye latar belakang', body: 'RabbitMQ mengantrekan pekerjaan, Redis membatasi laju koneksi SMTP dan kegagalan SMTP sementara dicoba kembali.' },
        { title: 'Status dan notifikasi', body: 'Lacak setiap penerima serta lihat notifikasi kampanye dan aktivitas login.' },
      ],
    },
    pdf: {
      title: 'Slip gaji dapat menjadi bagian dari pesan, bukan pekerjaan terpisah.',
      body: 'Buat tata letak PDF yang dapat digunakan ulang dan lampirkan versi personal untuk setiap penerima.',
      documentTitle: 'SLIP GAJI · APRIL',
      rows: ['Gaji pokok', 'Tunjangan', 'Pajak dan potongan'],
      total: 'Gaji bersih',
    },
    security: {
      title: 'Server email Anda. Data Anda. Deployment Anda.',
      items: [
        'Hubungkan server SMTP sendiri, kredensial SMTP dienkripsi saat tersimpan.',
        'Host Slipakar sendiri di infrastruktur yang Anda kelola.',
        'Placeholder hanya mengganti teks dan tidak menjalankan kode template.',
        'Menonaktifkan akun langsung mencabut sesi akun tersebut.',
      ],
    },
    selfHost: {
      title: 'Jalankan di lingkungan organisasi Anda.',
      body: 'Deploy aplikasi dengan Docker dan kendalikan layanan beserta datanya.',
      guide: 'Baca panduan self-hosting',
      codeLabel: 'Jalankan stack',
    },
    openSource: {
      title: 'Open source dengan lisensi Apache-2.0.',
      body: 'Tinjau kode sumber, jalankan Slipakar sendiri, dan sesuaikan deployment untuk organisasi Anda.',
      license: 'Lisensi Apache-2.0',
      repository: 'Lihat repositori',
    },
    faq: {
      title: 'Pertanyaan yang sering diajukan.',
      items: [
        { question: 'Apa itu Slipakar?', answer: 'Slipakar adalah platform open-source yang dapat di-host sendiri untuk email massal personal melalui server SMTP perusahaan.' },
        { question: 'Bisakah setiap penerima mendapat PDF berbeda?', answer: 'Bisa. Kampanye dapat melampirkan PDF personal, seperti slip gaji, untuk setiap penerima.' },
        { question: 'Format file data apa yang didukung?', answer: 'Slipakar mendukung file CSV, XLSX, dan JSON.' },
        { question: 'Apakah placeholder email menjalankan kode?', answer: 'Tidak. Template email menggunakan penggantian placeholder yang aman dan tidak mengevaluasi ekspresi atau kode.' },
        { question: 'Bagaimana kampanye dikirim?', answer: 'Pekerjaan kampanye diantrekan melalui RabbitMQ dan dikirim di latar belakang, dengan status per penerima dan percobaan ulang untuk kegagalan SMTP sementara.' },
        { question: 'Di mana kredensial SMTP disimpan?', answer: 'Kredensial SMTP dienkripsi saat tersimpan menggunakan kunci enkripsi aplikasi dan tidak dikembalikan melalui API.' },
        { question: 'Bisakah Slipakar di-host sendiri?', answer: 'Bisa. Slipakar dirancang untuk self-hosting dan di-deploy dengan Docker.' },
      ],
    },
    final: {
      title: 'Kirim email personal sesuai cara Anda.',
      body: 'Mulai dengan server SMTP dan data penerima yang sudah Anda miliki.',
      signIn: 'Masuk ke Slipakar',
      terms: 'Ketentuan',
      repository: 'Repositori',
    },
  },
  terms: {
    metadata: { title: 'Ketentuan penggunaan — Slipakar', description: 'Ketentuan penggunaan Slipakar, platform open source untuk email massal yang dipersonalisasi dengan lampiran PDF.', path: '/id/terms' },
    kicker: 'HUKUM',
    heading: 'Ketentuan penggunaan',
    intro: 'Ketentuan ini menjelaskan bagaimana Slipakar, platform open source untuk email massal yang dipersonalisasi, boleh digunakan.',
    sections: [
      { title: 'Menggunakan Slipakar', body: ['Slipakar adalah perangkat lunak yang di-host sendiri. Setiap organisasi menjalankan deployment-nya sendiri dan menentukan siapa yang boleh masuk, server SMTP yang dipakai, serta cara data disimpan.', 'Dengan menggunakan sebuah deployment Slipakar, Anda setuju mengikuti aturan organisasi yang menjalankannya dan aturan penyedia email Anda.'] },
      { title: 'Penggunaan yang dapat diterima', body: ['Kirim hanya pesan, spreadsheet, dan lampiran yang memang berhak Anda proses.', 'Jangan gunakan Slipakar untuk mengirim email massal yang tidak diminta, menyamar sebagai pihak lain, atau melanggar hukum maupun aturan penyedia SMTP Anda.'] },
      { title: 'Data dan file Anda', body: ['Data penerima, template, dan PDF hasil olahan tetap berada di infrastruktur organisasi yang menjalankan deployment. Organisasi tersebut bertanggung jawab atas kontrol akses, pencadangan, dan lama penyimpanan data.'] },
      { title: 'Lisensi perangkat lunak dan tanpa jaminan', body: ['Slipakar dirilis di bawah Apache License 2.0 dan disediakan apa adanya, tanpa jaminan apa pun. Baca berkas lisensi di repositori untuk ketentuan lengkapnya.'] },
      { title: 'Perubahan dan kontak', body: ['Ketentuan ini dapat diperbarui dari waktu ke waktu. Untuk pertanyaan tentang sebuah deployment, hubungi organisasi yang menjalankannya. Untuk pertanyaan tentang perangkat lunaknya, gunakan repositori proyek.'] },
    ],
    homeLabel: 'Kembali ke Slipakar',
  },
  notFound: {
    kicker: '404 · TIDAK DITEMUKAN',
    title: 'Halaman ini tidak ada.',
    body: 'Alamatnya mungkin sudah usang atau halamannya sudah dipindahkan.',
    homeLabel: 'Kembali ke Slipakar',
  },
};
