import { DiscoveryRequest } from "@emergency/shared";
import { appFor, internal, errors, mode } from "@emergency/server-kit";
import { discoverLive } from "./live";
const app = appFor("discovery", () => ({ liveReady: mode === "live" && !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_TEXT_MODEL }));
app.post("/discover", internal, async (req, res) => {
  const input = DiscoveryRequest.parse(req.body);
  if (mode === "live") {
    res.json(await discoverLive(input.input, input.searchAt));
    return;
  }
  // Four simulated candidates so the three-business limit is exercised on every test-mode run.
  res.json({
    businesses: [
      "Demo Mobile Mechanics",
      "Demo Roadside Repair",
      "Demo Auto Rescue",
      "Demo Tow and Tire",
    ].slice(0, 3).map((name, i) => ({
      id: `demo-${i + 1}`,
      name,
      phone: `+1202555010${i}`,
      sourceUrl: null,
      openingStatus: "unknown",
      checkedAt: input.searchAt,
    })),
    warnings: ["SIMULATED discovery. Businesses and numbers are fictional."],
  });
});
errors(app);
app.listen(Number(process.env.DISCOVERY_PORT ?? 4101), "127.0.0.1", () =>
  console.log("Discovery ready"),
);
