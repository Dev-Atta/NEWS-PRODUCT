// Builds one mixed feed from all stories.
// Each step picks a category at random, weighted by the reader's interest
// score, then takes that category's best-ranked remaining story.
// Higher scores appear more often and earlier, but nothing is fully predictable.
export function weightedFeed(articles = [], interests = []) {
  const scores = new Map(interests.map((i) => [i.keyword, i.weight]));
  const queues = new Map();

  for (const a of articles) {
    const key = a.interest || "other";
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(a);
  }

  const weightOf = (key) => {
    const queue = queues.get(key);
    let w = scores.get(key) ?? 2;
    // New-for-you stories get a boost so they are not buried at the bottom
    if (queue[0]?.exploration) w = Math.max(w, 4);
    return Math.max(0.5, w);
  };

  const feed = [];
  while (queues.size > 0) {
    const keys = [...queues.keys()];
    const weights = keys.map(weightOf);
    let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);

    let pick = keys[keys.length - 1];
    for (let i = 0; i < keys.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pick = keys[i];
        break;
      }
    }

    const queue = queues.get(pick);
    feed.push(queue.shift());
    if (queue.length === 0) queues.delete(pick);
  }

  return feed;
}