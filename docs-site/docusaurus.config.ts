import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'absenta13',
  tagline: 'Dokumentasi teknis absenta13',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://absenta13.my.id',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'absenta13', // Usually your GitHub org/user name.
  projectName: 'absenta13-docs', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/logo.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'absenta13',
      logo: {
        alt: 'absenta13 Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Dokumentasi',
        },
        {
          href: 'https://absenta13.my.id',
          label: 'Aplikasi',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Dokumentasi',
          items: [
            {
              label: 'Pengantar',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Operasional',
          items: [
            {
              label: 'Backup dan Restore',
              to: '/docs/tutorial-extras/manage-docs-versions',
            },
            {
              label: 'Monitoring dan Keamanan',
              to: '/docs/tutorial-extras/translate-your-site',
            },
          ],
        },
        {
          title: 'Lainnya',
          items: [
            {
              label: 'Aplikasi',
              href: 'https://absenta13.my.id',
            },
          ],
        },
      ],
      copyright: `Copyright Ac ${new Date().getFullYear()} absenta13.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
