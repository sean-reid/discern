import { Header } from "@/components/Header";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-[100dvh] mx-auto w-full max-w-2xl">
      <Header />

      <div className="flex-1 px-5 py-8 space-y-8">
        <section>
          <h1 className="text-2xl font-bold mb-3">What is Discern?</h1>
          <p className="text-sm text-muted leading-relaxed">
            A game that tests your ability to tell real photos from
            AI-generated ones. You see a photo, you swipe. Left if you
            think it was made by AI, right if you think it is real. That
            is it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">How to play</h2>
          <div className="space-y-2 text-sm text-muted leading-relaxed">
            <p>
              Swipe or drag the photo to the left if you think it is
              AI-generated, or to the right if you think it is a real
              photograph. On desktop, use the arrow keys.
            </p>
            <p>
              You start with a rating of 1200. Get it right and your
              rating goes up. Get it wrong and it drops. The images have
              ratings too, so correctly identifying a tricky image earns
              you more points.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Why?</h2>
          <p className="text-sm text-muted leading-relaxed">
            AI-generated images are getting harder to spot. Discern is a
            way to sharpen that skill while tracking how good you actually
            are. No accounts, no ads, no data collection. Just photos and
            your judgment.
          </p>
        </section>

        <section className="pt-2 space-y-3">
          <a
            href="https://github.com/sean-reid/discern"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-muted hover:text-fg transition-colors"
          >
            Source code on GitHub
          </a>
          <p className="text-xs text-muted/50">
            Built by Sean Reid
          </p>
        </section>

      </div>
    </div>
  );
}
