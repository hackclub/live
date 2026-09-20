import Link from "next/link";



export default function Navbar() {



    return (
        <>

        <div className="sticky top-0 p-4 z-60 left-0 w-screen">
            <Link href="/" prefetch={false} className="link">
                go back to homepage
            </Link>
        </div>




        </>
    )
}
