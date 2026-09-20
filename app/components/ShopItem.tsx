"use client";
import React, {useState} from "react";
import Link from "next/link";
import Image from "next/image";


type PropItems = {
    img: string;
    name: string;
    price: number;
    description?: string;

}

export default function ShopItem(props: PropItems) {
    const [isClicked, setIsClicked] = useState<boolean>(false);




    return (
        <>
        
        {isClicked && (
            <>
                <section className="fixed top-0 left-0 opacity-65 bg-black z-99 w-screen h-screen"></section>
                <div className="fixed rounded-box border border-secondary p-4 bg-base-300 min-w-3/6 z-100 top-[30%] translate-y-[-50%] left-[50%] translate-x-[-50%]">
                    <Image src={props.img} alt={props.name} width={640} height={160} className="w-full h-40 object-cover" />

                    <div className="flex gap-2  items-center flex-row">
                <p className="text-error text-2xl">~{props.price}</p>
                <p> hours</p>
            </div>

            <p>{props.name}</p>

            <div className="mt-2 bg-base-100 p-2 ">
                <p className="text-xs font-2">lil description</p>

                <p className="mt-2">{props.description ?? "i lowk forgot to write one. sorry"}</p>

            </div>


            <div className="grid grid-cols-2 gap-2 w-full">
            <button onClick={() => setIsClicked((prev) => !prev)} className="w-full btn btn-outline mt-2">
             let&apos;s go back
            </button>
             <Link href="/dashboard" prefetch={false} className="btn w-full btn-secondary mt-2">
                earn now!
            </Link>

            </div>
           
                </div>
             
            </>


        )}

        <div onClick={() => setIsClicked((prev) => !prev)} className="p-3 hover:scale-105 duration-150 cursor-pointer w-fit w-40 border-b border-r border-dashed">

            <Image src={props.img} alt={props.name} width={160} height={160} className="w-full object-cover h-40 rounded-lg" />
            <div className="flex gap-2  items-center flex-row">
                <p className="text-error text-2xl">~{props.price}</p>
                <p> hours</p>
            </div>

            <p>{props.name}</p>

        </div>

        </>
    )
}
