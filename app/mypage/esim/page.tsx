import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MyEsimOrdersClient from "./MyEsimOrdersClient";

export default async function MyEsimPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/mypage/esim");
  }

  return <MyEsimOrdersClient />;
}
