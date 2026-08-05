import { ListenRoom } from "./_components/listen-room";

// Everything on this page is live state the client fetches, so the server
// component is just the shell.
export default function Home() {
  return <ListenRoom />;
}
