import { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Game Guild',
    default: 'Game Guild',
  },
  description: 'A awesome game development community',
};

type Props = {
  children: React.ReactNode;
};
export default async function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
