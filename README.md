# Le Ballon Rouge

A 30-second animated short. A red balloon rides the morning wind over the rooftops of Paris, drifts down into a street in Ménilmontant, and catches on a lamp post just as a boy walks up and notices it.

Everything is generated in the browser. The pictures are drawn on a canvas, the string is simulated with physics, and the piano, strings, wind, bells and footsteps are synthesised with the Web Audio API. There are no image or audio files.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview  # serve the build
```

Click **Play with sound** to start (browsers only allow audio after a click). Space pauses, M mutes, R restarts.

## Deploy

`vercel.json` configures a Vite build with `dist/` as the output directory, so the repository can be imported into Vercel as is.
