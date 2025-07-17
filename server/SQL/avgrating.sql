SELECT 
    c.id,
    c.name,
    c.description,
    c.image_url,
    c.created_at,
    c.updated_at,
    COALESCE(ROUND(AVG(r.rating::NUMERIC), 1), 0) as average_rating,
    COUNT(r.rating) as total_ratings,
    COUNT(DISTINCT p.id) as product_count
FROM 
    category c
LEFT JOIN 
    product p ON c.id = p.category_id
LEFT JOIN 
    ratings r ON p.id = r.product_id
GROUP BY 
    c.id, c.name, c.description, c.image_url, c.created_at, c.updated_at
ORDER BY 
    average_rating DESC, total_ratings DESC;