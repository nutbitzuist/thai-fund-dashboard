import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'กองทุนไทย Research Dashboard',
    short_name: 'กองทุนไทย',
    description: 'ค้นหาและเปรียบเทียบกองทุนรวมไทย',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#1D4ED8',
    icons: [
      { src: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
  }
}
