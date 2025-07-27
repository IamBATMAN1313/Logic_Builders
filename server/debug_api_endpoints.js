const fs = require('fs');
const path = require('path');

function findRatingEndpoints() {
  console.log('=== SEARCHING FOR RATING API ENDPOINTS ===\n');
  
  const routerDir = path.join(__dirname, 'router');
  
  try {
    // Check if Reviews directory exists
    const reviewsDir = path.join(routerDir, 'Reviews');
    if (fs.existsSync(reviewsDir)) {
      const files = fs.readdirSync(reviewsDir);
      console.log('Files in Reviews directory:', files);
      
      files.forEach(file => {
        if (file.endsWith('.js')) {
          const filePath = path.join(reviewsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          console.log(`\n--- ${file} ---`);
          
          // Look for endpoint definitions
          const routeMatches = content.match(/router\.(get|post|put|delete)\s*\([^)]+\)/g);
          if (routeMatches) {
            console.log('Endpoints found:');
            routeMatches.forEach(match => console.log('  ', match));
          } else {
            console.log('No standard router endpoints found');
          }
          
          // Look for specific rating-related functions
          const ratingMatches = content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm);
          if (ratingMatches) {
            console.log('Comments found:');
            ratingMatches.slice(0, 3).forEach(match => console.log('  ', match.trim()));
          }
        }
      });
    } else {
      console.log('Reviews directory not found at:', reviewsDir);
    }
    
    // Check for ratings.js file
    const ratingsFile = path.join(reviewsDir, 'ratings.js');
    if (fs.existsSync(ratingsFile)) {
      console.log('\n=== RATINGS.JS CONTENT PREVIEW ===');
      const content = fs.readFileSync(ratingsFile, 'utf8');
      const lines = content.split('\n');
      
      // Show first 50 lines
      console.log('First 50 lines:');
      lines.slice(0, 50).forEach((line, index) => {
        console.log(`${index + 1}: ${line}`);
      });
      
      // Look for the error location mentioned (line 132)
      if (lines.length > 130) {
        console.log('\n=== AROUND LINE 132 (ERROR LOCATION) ===');
        lines.slice(125, 140).forEach((line, index) => {
          console.log(`${126 + index}: ${line}`);
        });
      }
    }
    
    // Also check main router files
    const mainFiles = fs.readdirSync(routerDir);
    console.log('\n=== MAIN ROUTER FILES ===');
    console.log(mainFiles);
    
    // Check if ratings is included in main router
    const indexRouter = path.join(routerDir, 'indexRouter.js');
    if (fs.existsSync(indexRouter)) {
      const content = fs.readFileSync(indexRouter, 'utf8');
      console.log('\n=== INDEX ROUTER CONTENT ===');
      console.log(content);
    }
    
  } catch (error) {
    console.error('Error reading directories:', error);
  }
}

findRatingEndpoints();
