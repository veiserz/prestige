**Backend Technical Task – Prestige Club** 

⏱ **Estimated Time** 

Maximum 2 hours 

�� **Goal** 

Implement a simplified version of a user matching system using Node.js. **Preferred stack:** 

● Node.js (v20+) 

● Fastify (preferred) or Express 

● PostgreSQL 

You may use an ORM or raw SQL. 

✅ **Requirements** 

**1**⃣**User Model** 

Create a User entity with the following fields: 

● `id` (uuid or serial) 

● `name` (string) 

● `age` (integer) 

● `city` (string) 

● `educationLevel` (enum) 

● `goals` (array of strings) 

● `score_selfGrowth` (number between 0–100) 

*Design the database schema properly and mention any indexes you would add.* **2**⃣**API Endpoints**  
● **POST /users**: Create a new user. 

● **GET /users**: Retrieve all users. 

● **GET /users/:id/match**: Return the top 3 most compatible users for the specified user. **3**⃣**Matching Algorithm** 

Calculate a Compatibility Score between two users based on: 

● Same city (20%) 

● Age difference (20%) 

● Number of shared goals (30%) 

● Difference in `score_selfGrowth` (30%) 

*The formula must be logical and explainable.* 

**4**⃣**Evaluation Criteria** 

● Database design quality 

● Code structure and cleanliness 

● API design 

● Error handling 

● Matching logic clarity 

● Performance considerations 

**5**⃣**Short Written Explanation (Required in README)** 

Include a short README explaining: 

● How to run the project 

● Your compatibility score logic 

● Suggested indexes 

● If the system scales to 1M+ users, what optimizations would you apply? ● Where would caching be useful? 

�� **Submission** 

Provide: 

● GitHub repository link 

● Clear setup instructions in README  
**Appendix: Compatibility Score Logic** 

The compatibility score ( S ) is calculated on a scale of 0 to 100 based on the following weighted criteria: 

\[ S \= 0.2(C) \+ 0.2(A) \+ 0.3(G) \+ 0.3(S\_{g}) \] 

Where: 

● **City ((C))**: 100 if cities match, 0 otherwise. 

● **Age ((A))**: Based on the absolute difference (\\Delta a \= |age\_1 \- age\_2|). Score is (100 \\times \\max(0, 1 \- \\frac{\\Delta a}{20})), assuming a 20-year gap results in 0 compatibility. ● **Goals ((G))**: Percentage of shared goals relative to the total unique goals between both users: (100 \\times \\frac{|Goals\_1 \\cap Goals\_2|}{|Goals\_1 \\cup Goals\_2|}). ● **Self-Growth ((S\_{g}))**: Based on the absolute difference (\\Delta s \= |score\_1 \- score\_2|). Score is (100 \- \\Delta s), ensuring a score between 0 and 100\.