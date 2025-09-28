import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] px-4 text-center">
      <h2 className="text-6xl font-bold gradient gradient-title mb-4">404</h2>
      <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
      <Button
        asChild
        variant={"outline"}
        size={"lg"}
        className="border-green-600 text-green-600 hover:bg-green-50"
      >
        <Link href="/">Return Home</Link>
      </Button>
    </div>
  );
}
