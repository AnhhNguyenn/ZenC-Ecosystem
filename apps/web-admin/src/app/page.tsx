import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root path to the login page
  redirect('/login');
}
