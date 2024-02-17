import PestManagement from "@/app/pest_management/page";

export default function Home() {

    return (
        <div className={"flex flex-col w-1/4"}>
            <div className={"flex flex-col text-center bg-white w-full text-black border border-black shadow-lg " +
                "mb-4 sm:mx-2 p-5"}>
                Pest Management
            </div>
            <div className={"flex flex-col text-center bg-white w-full text-black border border-black shadow-lg " +
                "mb-4 sm:mx-2 p-5"}>
                Chickens
            </div>
        </div>

    );
}
