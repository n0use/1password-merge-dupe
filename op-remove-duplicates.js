/**
 * 1Password Duplicate Remover
 * 
 * Usage: node 1password-duplicate.js
 * 
 * Author: Will Hackett
 * 
 * License: MIT
 * 
 * Requirements:
 * - 1Password CLI (https://1password.com)
 * - Node >=16 (https://nodejs.org)
 * 
 */

// Set this to false to perform actual deletions
const DRY_RUN = true;

const { execSync } = require('child_process');

const itemsJson = execSync('op items list --format=json').toString();
const items = JSON.parse(itemsJson);

const duplicates = {};

items.forEach((item) => {
  const key = item.title;
  if (!duplicates[key]) {
    duplicates[key] = [];
  }
  duplicates[key].push(item);
});

const mergeItems = (item1, item2) => {
  if (item1.fields.length !== item2.fields.length || item1.urls.length !== item2.urls.length) {
    return false;
  }

  const fields1 = item1.fields.sort((a, b) => a.id.localeCompare(b.id));
  const fields2 = item2.fields.sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < fields1.length; i++) {
    if (fields1[i].id !== fields2[i].id || fields1[i].value !== fields2[i].value) {
      return false;
    }
  }

  const urls1 = item1.urls.map(url => url.href).sort();
  const urls2 = item2.urls.map(url => url.href).sort();

  for (let i = 0; i < urls1.length; i++) {
    if (urls1[i] !== urls2[i]) {
      return false;
    }
  }

  return true;
};

Object.keys(duplicates).forEach((key) => {
  if (duplicates[key].length > 1) {
    const itemsToMerge = duplicates[key].map(item => {
      const itemDetailsJson = execSync(`op item get ${item.id} --format=json`).toString();
      const itemDetails = JSON.parse(itemDetailsJson);
      return { ...item, ...itemDetails };
    });

    const mergedItems = [itemsToMerge[0]];

    for (let i = 1; i < itemsToMerge.length; i++) {
      let isDuplicate = false;

      for (const mergedItem of mergedItems) {
        if (mergeItems(mergedItem, itemsToMerge[i])) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        console.log(`Deleting duplicate item ${itemsToMerge[i].id}`);
        if (DRY_RUN === false) {
          execSync(`op delete item ${itemsToMerge[i].id}`);
        }
      } else {
        mergedItems.push(itemsToMerge[i]);
      }
    }
  }
});