-- Deaktiviraj aktivne gost-botove; zapisi i povijest partija ostaju.
UPDATE "botovi"
SET "aktivan" = false
WHERE "tip" = 'gost' AND "aktivan" = true;
