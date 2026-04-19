import { redirect } from 'next/navigation';

/** Legacy `/landing` URL — marketing home is `/`. */
export default function LandingRedirectPage() {
  redirect('/');
}
