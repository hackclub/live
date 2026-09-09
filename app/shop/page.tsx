import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import ShopItem from "../components/ShopItem"
import { shopItemsByPriceAsc } from "../../src/lib/shopItems"

export default function Shop() {

    return (
        <>

        <Navbar />


        <section className="w-4/6 font-2 mx-auto min-h-screen">
            <p className="text-4xl text-left mb-10">here are da things you could earn by shipping.</p>

            <div className="flex flex-row flex-wrap gap-4">
        {shopItemsByPriceAsc.map((item, i) => (
                <ShopItem key={i} name={item.name} price={item.price} description={item.description} img={item.img} />


            ))}
            </div>



        </section>


        <Footer />

        </>
    )
}


