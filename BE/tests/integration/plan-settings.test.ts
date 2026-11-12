import { beforeAll, describe, expect, it } from 'vitest';
import { AppSettingModel, DEFAULT_PLANS } from '../../src/models/app-setting.model';
import { getAppSettings, getPlanConfig, updateAppSettings } from '../../src/services/app-setting.service';
import { updatePlansSchema } from '../../src/validators/plan.validator';

beforeAll(() => AppSettingModel.init());

const plans = {
  free: { priceVnd: 0, maxPassages: 5, canCreateErrorPractice: false, canUsePublicPassages: false },
  premium: { priceVnd: 120000, maxPassages: 50, canCreateErrorPractice: true, canUsePublicPassages: true }
};

describe('plan settings', () => {
  it('answers the default plans until an admin saves', async () => {
    const settings = await getAppSettings();

    expect(settings.plans.free.maxPassages).toBe(9);
    expect(settings.plans.premium.maxPassages).toBe(90);
    expect(settings.plans.premium.priceVnd).toBe(99000);
    expect(await getPlanConfig('free')).toMatchObject(DEFAULT_PLANS.free);
    expect(await getPlanConfig('premium')).toMatchObject(DEFAULT_PLANS.premium);
  });

  it('saves both plans and keeps the other settings', async () => {
    await updateAppSettings({ dailyTaskCount: 5 });

    const saved = await updateAppSettings({ plans });

    expect(saved.plans.free.maxPassages).toBe(5);
    expect(saved.plans.premium).toMatchObject(plans.premium);
    expect(saved.dailyTaskCount).toBe(5);
    expect(await getPlanConfig('premium')).toMatchObject(plans.premium);
  });

  it('answers the default plans for a settings document saved before plans existed', async () => {
    await AppSettingModel.collection.insertOne({ key: 'global', dailyTaskCount: 4, placementMinAccuracy: 90 });

    expect(await getPlanConfig('free')).toMatchObject(DEFAULT_PLANS.free);
    expect((await getAppSettings()).dailyTaskCount).toBe(4);
  });

  it('refuses a negative or fractional quota and price, and a missing plan', () => {
    expect(updatePlansSchema.safeParse(plans).success).toBe(true);
    expect(updatePlansSchema.safeParse({ ...plans, free: { ...plans.free, maxPassages: -1 } }).success).toBe(false);
    expect(updatePlansSchema.safeParse({ ...plans, free: { ...plans.free, maxPassages: 1.5 } }).success).toBe(false);
    expect(updatePlansSchema.safeParse({ ...plans, premium: { ...plans.premium, priceVnd: -5 } }).success).toBe(false);
    expect(updatePlansSchema.safeParse({ free: plans.free }).success).toBe(false);
  });

  it('accepts a quota of 0', () => {
    expect(updatePlansSchema.safeParse({ ...plans, free: { ...plans.free, maxPassages: 0 } }).success).toBe(true);
  });
});
