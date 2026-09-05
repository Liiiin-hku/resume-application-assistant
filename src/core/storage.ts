import {
  emptyProfile,
  validateProfile,
  type Profile,
  type SiteRule,
} from "./model";
export async function secureStorage() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  await chrome.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
}
export async function loadProfile(): Promise<Profile> {
  const { profile } = await chrome.storage.local.get("profile");
  return profile ? validateProfile(profile) : emptyProfile();
}
export async function saveProfile(profile: Profile, expectedRevision: number) {
  return navigator.locks.request("resume-profile-write", async () => {
    const { profile: stored } = await chrome.storage.local.get("profile");
    if (stored && validateProfile(stored).revision !== expectedRevision)
      throw new Error("资料已在其他窗口更新。请刷新本页后重新修改，避免覆盖。");
    const clean = validateProfile(profile);
    clean.revision = expectedRevision + 1;
    await chrome.storage.local.set({ profile: clean });
    return clean;
  });
}
export async function loadRules(): Promise<SiteRule[]> {
  const { rules } = await chrome.storage.local.get("rules");
  return Array.isArray(rules) ? rules.slice(0, 500) : [];
}
export async function saveRule(rule: SiteRule) {
  const old = await loadRules();
  const rules = old.filter(
    (r) =>
      !(
        r.origin === rule.origin &&
        r.path === rule.path &&
        r.signature === rule.signature
      ),
  );
  rules.push(rule);
  await chrome.storage.local.set({ rules: rules.slice(-500) });
}
