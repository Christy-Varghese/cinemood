import Image from "next/image";
import { IMG } from "@/lib/tmdb/images";
import { REGIONS } from "@/lib/reference";
import { t } from "@/lib/i18n";
import type { WatchAvailability, WatchProvider } from "@/types/movie";

function Group({ label, list }: { label: string; list: WatchProvider[] }) {
  if (!list.length) return null;
  return (
    <div className="provider-group">
      <h3>{label}</h3>
      <div className="provider-list">
        {list.map((p) => {
          const src = IMG.logo(p.logoPath);
          return (
            <span className="provider" key={p.id} title={p.name}>
              {src ? <Image src={src} alt={p.name} width={46} height={46} /> : <span className="sr-only">{p.name}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Licensed availability only — TMDB's JustWatch data. Nothing here is guessed. */
export function WatchOptions({ availability, region }: { availability: WatchAvailability | null; region: string }) {
  const regionName = REGIONS.find((r) => r.code === region)?.name ?? region;
  const any = availability && [availability.subscription, availability.free, availability.ads, availability.rent, availability.buy].some((l) => l.length);
  return (
    <div>
      {any ? (
        <div className="providers">
          <Group label="Stream" list={availability!.subscription} />
          <Group label="Free" list={[...availability!.free, ...availability!.ads]} />
          <Group label="Rent" list={availability!.rent} />
          <Group label="Buy" list={availability!.buy} />
          {availability!.link && (
            <a className="btn btn-outline btn-sm" href={availability!.link} target="_blank" rel="noreferrer" style={{ justifySelf: "start" }}>
              See all options in {regionName}
            </a>
          )}
        </div>
      ) : (
        <p className="muted-note">
          {t.movie.noProviders} ({regionName})
        </p>
      )}
      <p className="muted-note" style={{ marginTop: 12 }}>
        {t.movie.providedBy}.
      </p>
    </div>
  );
}
