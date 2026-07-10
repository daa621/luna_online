import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'AI Story RPG', description: 'Browserbasiertes KI-Rollenspiel mit austauschbaren Providern' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}</body></html>; }
