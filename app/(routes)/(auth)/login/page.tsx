import { googleLogin } from "./actions";

export default function LoginPage() {
  return (
    <>
      <button onClick={googleLogin}>Sign In with Google</button>
    </>
  );
}
