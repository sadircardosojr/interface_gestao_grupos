const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'tree_db',
    password: 'postgres',
    port: 5432,
});

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Função para construir a árvore
function buildTree(nodes) {
    const nodeMap = new Map();
    const rootNodes = [];

    // Primeiro, mapeie todos os nós
    nodes.forEach(node => {
        nodeMap.set(node.id, { ...node, children: [] });
    });

    // Depois, construa a hierarquia
    nodes.forEach(node => {
        const nodeObj = nodeMap.get(node.id);
        if (node.parent_id === null) {
            rootNodes.push(nodeObj);
        } else {
            const parent = nodeMap.get(node.parent_id);
            if (parent) {
                parent.children.push(nodeObj);
            }
        }
    });

    return rootNodes;
}

// Rota para obter a estrutura da árvore
app.get('/api/tree', async (req, res) => {
    try {
        const result = await pool.query(`
            WITH RECURSIVE tree AS (
                SELECT id, name, parent_id, 1 as level
                FROM nodes
                WHERE parent_id IS NULL
                
                UNION ALL
                
                SELECT n.id, n.name, n.parent_id, t.level + 1
                FROM nodes n
                INNER JOIN tree t ON n.parent_id = t.id
            )
            SELECT * FROM tree
            ORDER BY level, id;
        `);

        const tree = buildTree(result.rows);
        res.json(tree);
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para salvar as condições
app.post('/api/save-conditions', async (req, res) => {
    console.log('Recebendo requisição para salvar condições:', req.body);
    
    const { nodeId, conditions } = req.body;
    
    if (!nodeId || !Array.isArray(conditions)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Dados inválidos. nodeId e conditions são obrigatórios.' 
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Remove condições existentes
        await client.query('DELETE FROM node_conditions WHERE node_id = $1', [nodeId]);

        // Insere novas condições
        for (const condition of conditions) {
            await client.query(
                'INSERT INTO node_conditions (node_id, condition_type, condition_value, condition_result) VALUES ($1, $2, $3, $4)',
                [nodeId, condition.type, condition.value, condition.result]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Condições salvas com sucesso' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar condições:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao salvar condições no banco de dados',
            details: error.message 
        });
    } finally {
        client.release();
    }
});

// Rota para salvar um novo nó
app.post('/api/save-node', async (req, res) => {
    console.log('Recebendo requisição para salvar novo nó:', req.body);
    
    const { parentId, node } = req.body;
    
    if (!parentId || !node || !node.name) {
        return res.status(400).json({ 
            success: false, 
            error: 'Dados inválidos. parentId e node.name são obrigatórios.' 
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insere o novo nó
        const result = await client.query(
            'INSERT INTO nodes (name, parent_id) VALUES ($1, $2) RETURNING id',
            [node.name, parentId]
        );

        const newNodeId = result.rows[0].id;

        await client.query('COMMIT');
        res.json({ 
            success: true, 
            message: 'Nó adicionado com sucesso',
            nodeId: newNodeId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar nó:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao salvar nó no banco de dados',
            details: error.message 
        });
    } finally {
        client.release();
    }
});

// Rota para carregar as condições
app.get('/api/conditions/:nodeId', async (req, res) => {
    try {
        const { nodeId } = req.params;
        const result = await pool.query(
            'SELECT condition_type, condition_value, condition_result FROM node_conditions WHERE node_id = $1 ORDER BY id',
            [nodeId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao carregar condições:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para servir o arquivo index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware para tratar rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Middleware para tratar erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
}); 