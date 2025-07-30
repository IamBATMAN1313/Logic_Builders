const fs = require('fs');
const csv = require('csv-parser');
const pool = require('../connection');

async function updateProductImages() {
    const results = [];
    
    console.log('Reading product_images.csv...');
    
    // Read the CSV file
    fs.createReadStream(__dirname + '/product_images.csv')
        .pipe(csv())
        .on('data', (data) => {
            results.push(data);
        })
        .on('end', async () => {
            console.log(`Found ${results.length} image entries`);
            
            let updated = 0;
            let notFound = 0;
            
            for (const row of results) {
                const productId = parseInt(row.id);
                const imageUrl = row.image_url;
                
                if (!productId || !imageUrl) {
                    console.log(`Skipping invalid row: ${JSON.stringify(row)}`);
                    continue;
                }
                
                try {
                    // Update the product table with the image URL
                    const result = await pool.query(
                        'UPDATE product SET image_url = $1 WHERE id = $2',
                        [imageUrl, productId]
                    );
                    
                    if (result.rowCount > 0) {
                        updated++;
                        console.log(`Updated product ${productId} with image`);
                    } else {
                        notFound++;
                        console.log(`Product with ID ${productId} not found`);
                    }
                } catch (error) {
                    console.error(`Error updating product ${productId}:`, error.message);
                }
            }
            
            console.log(`\nUpdate completed:`);
            console.log(`- Products updated: ${updated}`);
            console.log(`- Products not found: ${notFound}`);
            console.log(`- Total processed: ${results.length}`);
            
            process.exit(0);
        })
        .on('error', (error) => {
            console.error('Error reading CSV file:', error);
            process.exit(1);
        });
}

// Check if csv-parser is available, if not, provide instructions
try {
    require('csv-parser');
    updateProductImages();
} catch (error) {
    console.log('csv-parser module not found. Installing...');
    const { execSync } = require('child_process');
    
    try {
        execSync('npm install csv-parser', { cwd: __dirname + '/../../' });
        console.log('csv-parser installed successfully. Please run the script again.');
        process.exit(0);
    } catch (installError) {
        console.error('Failed to install csv-parser. Please run: npm install csv-parser');
        process.exit(1);
    }
}
