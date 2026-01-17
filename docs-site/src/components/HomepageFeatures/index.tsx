import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Arsitektur Terpisah',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
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
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
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
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Monitoring sistem, backup dan restore, export Excel berbasis template,
        serta konfigurasi kop laporan untuk kebutuhan administrasi sekolah.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
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
