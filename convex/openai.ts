import OpenAI from "openai";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const ResponseSchema = z.object({
  map: z.array(z.array(z.string())),
  reasoning: z.string(),
  playerCoordinates: z.array(z.number()),
  boxCoordinates: z.array(z.array(z.number())),
});

export const playMapAction = action({
  args: {
    map: v.array(v.array(v.string())),
    mapId: v.string(),
    level: v.number(),
  },
  handler: async (_, args) => {
    if (process.env.MOCK_OPEN_AI) {
      const existingMap = [...args.map.map((row) => [...row])];
      existingMap[0][0] = "P";
      existingMap[0][1] = "B";
      existingMap[0][2] = "B";
      return {
        map: existingMap,
        reasoning: "This is a mock response",
        playerCoordinates: [0, 0],
        boxCoordinates: [],
      };
    }

    // moving here for now so that I can get this deployed without a real key
    const openai = new OpenAI();

    try {
      const completion = await openai.beta.chat.completions.parse({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: `You're given a 2d grid of nums such that.
                      " " represents an empty space.
                      "Z" represents a zombie. Zombies move one Manhattan step every turn and aim to reach the player.
                      "R" represents rocks, which players can shoot over but zombies cannot pass through or break.
                      "P" represents the player, who cannot move. The player's goal is to shoot and kill zombies before they reach them.
                      "B" represents blocks that can be placed before the round begins to hinder the zombies. You can place up to two blocks on the map.
                      Your goal is to place the player ("P") and two blocks ("B") in locations that maximize the player's survival by delaying the zombies' approach while allowing the player clear lines of sight to shoot them before they get too close.
                      Returning a 2d grid with the player and blocks placed in the optimal locations, with the coordinates player ("P") and the blocks ("B"), also provide reasoning for the choices.`,
          },
          {
            role: "user",
            content: JSON.stringify(args.map),
          },
        ],
        response_format: zodResponseFormat(ResponseSchema, "game_map"),
      });

      const map_response = completion.choices[0].message;
      if (map_response.parsed) {
        return map_response.parsed;
      } else if (map_response.refusal) {
        const refusal_res = map_response.refusal;
        throw new Error(`Refusal: ${refusal_res}`);
      }
    } catch (error) {
      // todo: handle error
      console.log(error);
    }
  },
});
