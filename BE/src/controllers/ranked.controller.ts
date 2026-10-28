import { Request, Response } from 'express';
import * as rankedService from '../services/ranked.service';
import { closeSeason as closeSeasonById } from '../services/season.service';
import { LeaderboardQuery, ListSeasonsQuery } from '../validators/ranked.validator';

export const getMyRanking = async (req: Request, res: Response) => {
  res.json(await rankedService.getMyRanking(req.user!.sub));
};

export const getLeaderboard = async (req: Request, res: Response) => {
  res.json(await rankedService.getLeaderboard(req.query as unknown as LeaderboardQuery));
};

export const listSeasons = async (req: Request, res: Response) => {
  res.json(await rankedService.listSeasons(req.query as unknown as ListSeasonsQuery));
};

/** Closes the season early; answers the season opened in its place. */
export const closeSeason = async (req: Request, res: Response) => {
  res.json(await closeSeasonById(req.params.id as string));
};
