import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  alt: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Arsitektur Terpisah',
    image: require('@site/static/img/logo.png').default,
    alt: 'Logo absenta13',
    description: (
      <>
        Frontend React + Vite (5173), backend Node.js + Express (3001),
        database MySQL (3306), dan Redis (6379). Komunikasi melalui REST API,
        autentikasi JWT, serta caching dan queue untuk beban tinggi.
      </>
    ),
  },
  {
    title: 'Alur Absensi Terstruktur',
    image: require('@site/static/img/logo-kiri.png').default,
    alt: 'Logo absenta13 kiri',
    description: (
      <>
        Jadwal mengacu pada jadwal dan jam_pelajaran. Guru mengambil absensi
        siswa, siswa perwakilan mengabsen guru, dan banding absen dikelola
        dengan status serta riwayat per kelas.
      </>
    ),
  },
  {
    title: 'Operasional dan Laporan',
    image: require('@site/static/img/logo-kanan.png').default,
    alt: 'Logo absenta13 kanan',
    description: (
      <>
        Monitoring sistem, backup dan restore, export Excel berbasis template,
        serta konfigurasi kop laporan untuk kebutuhan administrasi sekolah.
      </>
    ),
  },
];

function Feature({title, image, alt, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img className={styles.featureSvg} src={image} alt={alt} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
