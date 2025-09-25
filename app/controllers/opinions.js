import { ComentarioSchema } from "../schemas/opinions.js";
import { database } from "../database.js";
const tableName = "comments";
async function addOpinion(req, res) {
    const validation = ComentarioSchema.validateComentarioSinId(req.body);
    console.log(req.body)
    if (!validation.success) {
        return res.status(400).send({ status: "Error", message: JSON.parse(validation.error.message) });
    }

    const { username_commentator, username_trayect, trayecto_id, opinion, rating } = validation.data;

    try {
        const connection = await database.getConnection();

        // Validar que el trayecto exista (opcional, mejora el mensaje de error)
        const [trayectoRows] = await connection.query("SELECT id FROM trayectos WHERE id = ?", [trayecto_id]);
        if (trayectoRows.length === 0) {
            return res.status(404).send({ status: "Error", message: "Trayecto no encontrado" });
        }

        let result;
        try {
            [result] = await connection.query(
                `INSERT INTO ${tableName} (username_commentator, username_trayect, id_trayecto, opinion, rating) VALUES (?, ?, ?, ?, ?)`,
                [username_commentator,username_trayect, trayecto_id, opinion, rating]
            );
        } catch (error) {
            switch (error.code) {
                case 'ER_NO_REFERENCED_ROW_2':
                    return res.status(400).send({ status: "Error", message: "El usuario o trayecto no existen" });
                case 'ER_DUP_ENTRY':
                    return res.status(400).send({ status: "Error", message: "La opinión ya existe o el usuario ya ha opinado para este trayecto" });
                default:
                    return res.status(500).send({ status: "Error", message: "Error al crear la opinión" });
            }
        }

        if (!result || result.affectedRows === 0) {
            return res.status(500).send({ status: "Error", message: "No se pudo crear la opinión" });
        }

        const newOpinion = { id: result.insertId, username_commentator,username_trayect, trayecto_id, opinion, rating };

        return res.status(201).send({
            status: "Success",
            message: "Opinión creada correctamente",
            opinion: newOpinion
        });
    } catch (error) {
        console.error("Error en addOpinion:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al crear la opinión" });
    }
}

async function getOpinionByUsernameCommentator(req, res){
    const { username } = req.params;
    console.log("Username de la opinión a buscar:", username);
    try {
        const connection = await database.getConnection()
        let opinionList = await connection.query(`SELECT * FROM ${tableName} WHERE username_commentator = ?`, [username]);
        if(opinionList[0].length === 0){
            return res.status(404).send({ status: "Error", message: `No se han encontrado opiniones para este usuario o el usuario no existe con username ${username}` });       
        }
        opinionList = opinionList[0];
        return res.status(200).send({
            status: "Success",
            opinionList
        })
    } catch (error) {
        console.error("Error en getOpinionByUsernameCommented:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al obtener opiniones" });
    }
    
}

async function getOpinionByUsernameTrayect(req, res){
    const { username } = req.params;
    console.log("Username de la opinión a buscar:", username);
    try {
        const connection = await database.getConnection()
        let opinionList = await connection.query(`SELECT * FROM ${tableName} WHERE username_trayect = ?`, [username]);
        if(opinionList[0].length === 0){
            return res.status(404).send({ status: "Error", message: `No se han encontrado opiniones para este usuario o el usuario no existe con username ${username} ` });
        }
        opinionList = opinionList[0];
        return res.status(200).send({
            status: "Success",
            opinionList
        })
    } catch (error) {
        console.error("Error en getOpinionByUsernameTrayect:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al obtener opiniones" });
    }
    
}

async function getOpinionsByTravelId(req, res) {
    const { travelId } = req.params;

    try {
        const connection = await database.getConnection();
        let opinionsList = await connection.query(`SELECT * FROM ${tableName} WHERE id_trayecto = ?`, [travelId]);

        if (opinionsList[0].length === 0) {
            return res.status(404).send({ status: "Error", message: `No se han encontrado opiniones para este trayecto o el trayecto no existe con id ${travelId}` });
        }

        opinionsList = opinionsList[0];

        return res.status(200).send({
            status: "Success",
            opinionsList
        });
    } catch (error) {
        console.error("Error en getOpinionsByTravelId:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al obtener opiniones" });
    }
}

async function patchComment(req, res){
    let { id } = req.params;
    id = parseInt(id);
    console.log("Id de la opinión a actualizar:", id);

    const validation = ComentarioSchema.validateComentarioUpdate(req.body);
    if (!validation.success) {
        return res.status(400).send({ status: "Error", message: JSON.parse(validation.error.message) });
    }


    const { opinion, rating,id_comment } = validation.data;
    console.log(typeof id_comment, typeof id);
    if(id_comment !== id){
        return res.status(400).send({ status: "Error", message: "El id de la opinión no coincide con el id de la opinión a actualizar" });
    }

    const connection = await database.getConnection();
    const [result] = await connection.query(`UPDATE ${tableName} SET opinion = ?, rating = ? WHERE id_comment = ?`, [opinion, rating, id_comment]);
    
    if (result.affectedRows === 0) {
        return res.status(404).send({ status: "Error", message: `Opinión no encontrada o la opinión no existe con id ${id_comment}` });
    }
    let updatedOpinion = await connection.query(`SELECT * FROM ${tableName} WHERE id_comment = ?`, [id_comment]);
    updatedOpinion = updatedOpinion[0][0];
    return res.status(200).send({ status: "Success", message: "Opinión actualizada correctamente", updatedOpinion });
}

async function deleteOpinion(req, res) {
    const { id } = req.params;

    try {
        const connection = await database.getConnection();
        const [result] = await connection.query(`DELETE FROM ${tableName} WHERE id_comment = ?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).send({ status: "Error", message: `Opinión no encontrada o la opinión no existe con id ${id}` });
        }

        return res.status(200).send({ status: "Success", message: "Opinión eliminada correctamente" });
    } catch (error) {
        console.error("Error en deleteOpinion:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al eliminar la opinión" });
    }
}

export const OpinionsController = {
    addOpinion,
    deleteOpinion,
    getOpinionsByTravelId,
    getOpinionByUsernameCommentator,
    getOpinionByUsernameTrayect,
    patchComment
};