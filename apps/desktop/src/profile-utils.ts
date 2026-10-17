export function profilePartition(profileId: string): string {
  if (!profileId || !/^[a-zA-Z0-9-]{1,128}$/.test(profileId)) {
    throw new Error("Invalid profile identifier.");
  }
  return "persist:browserspace-" + profileId;
}
