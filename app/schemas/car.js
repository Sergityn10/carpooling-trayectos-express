import { z } from "zod";

const CarSchema = z.object({
    id_car: z.number().int().positive(),
    matricula: z.string(),
    marca: z.string(),
    modelo: z.string(),
    color: z.string(),
    anyo: z.number(),
    tipo: z.string(),
    
})

const CarSchemaPartial = CarSchema.partial();
const CarSchemaSinId = CarSchema.omit({ id_car: true });

function validateCar(car){
    return CarSchema.safeParse(car);
}


function validateCarSinId(car) {
    return CarSchemaSinId.safeParse(car);
}

function validateCarPartial(car) {
    return CarSchemaPartial.safeParse(car);
}

export const CarsSchema = {
    CarSchema,
    validateCar,
    validateCarSinId,
    validateCarPartial
}
