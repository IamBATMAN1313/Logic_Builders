SELECT *
FROM (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY id) AS rn
    FROM product
) sub
WHERE rn <= 1;
