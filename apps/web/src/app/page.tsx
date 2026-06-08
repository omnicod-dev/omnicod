import { Nav } from "@/components/Nav"
import { Hero } from "@/components/sections/Hero"
import { WhyOmniCod } from "@/components/sections/WhyOmniCod"
import { Features } from "@/components/sections/Features"
import { Install } from "@/components/sections/Install"
import { Waitlist } from "@/components/sections/Waitlist"
import { Footer } from "@/components/sections/Footer"

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <WhyOmniCod />
        <Features />
        <Install />
        <Waitlist />
      </main>
      <Footer />
    </>
  )
}
