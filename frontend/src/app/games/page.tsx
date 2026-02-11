import Header from '@/components/Header'
import GameGrid from '@/components/GameGrid'
import Footer from '@/components/Footer'

export default function GamesPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-grow">
        <GameGrid />
      </div>
      <Footer />
    </main>
  )
}
