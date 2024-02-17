import PestManagement from "@/app/pest_management/page";

export default function Home() {

  return (
      <div className={"flex flex-col items-center justify bg-amber-400"}>
          <div className={"p-10 w-1/4"}>
              <PestManagement/>
          </div>
      </div>

  );
}
