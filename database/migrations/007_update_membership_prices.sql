UPDATE "ServicePlan"
SET "priceMinor" = CASE "name"
  WHEN 'Discovery' THEN 199900
  WHEN 'Signature' THEN 299900
  WHEN 'Privilege' THEN 599900
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "name" IN ('Discovery', 'Signature', 'Privilege');
