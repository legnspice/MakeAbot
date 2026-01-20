// "use client";

// import { useEffect } from "react";
// import { createClient } from "@/lib/supabase/client";

// export function AuthListener() {
//   useEffect(() => {
//     const supabase = createClient();
//     const {
//       data: { subscription },
//     } = supabase.auth.onAuthStateChange(async (event, session) => {
//       console.log(session?.user?.email);
//       if (event === "SIGNED_IN" && session?.user?.email) {
//         if (!session.user.email.endsWith("@student.ateneo.edu")) {
//           await supabase.auth.signOut();
//           console.log("sign out reached");
//         }
//       }
//     });
//     return () => subscription.unsubscribe();
//   }, []);
//   return null;
// }
